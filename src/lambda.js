import AWS from "aws-sdk";
if (process.env.IS_LOCAL) {
  AWS.config.logger = console;
}

import qs from "qs";
import axios from "axios";
const ddb = new AWS.DynamoDB.DocumentClient();

const API_URL = "https://slack.com/api";
const TEAM_ID = "T01JJ7B6URX"; // SST Slack workspace
const APP_ID = "A02S3B3KSJH"; // SST Support Slack app
const CHANNEL_IDS = [
  "C01JG3B20RY",  // #help
  "C01UJ8MDHEH",  // #seed
  "C01HQQVC8TH",  // #sst
  "C02RRTC2E9M",  // #support-test
];
const AGENT_USER_IDS = [
  "U01MV4U2EV9",  // Dax
  "U01JVDKASAC",  // Frank
  "U01J5Q8HV5Z",  // Jay
  "U02H0KUJFH7",  // Manitej
];
const STATUS = {
  OPEN: "open",
  CLOSED: "closed",
};

export async function subscription(event) {
  const body = JSON.parse(event.body);

  await handleEvent(body);

  return {
    body: body.challenge
  };
}

export async function interactive(event) {
  const buf = Buffer.from(event.body, 'base64').toString();
  const payload = JSON.parse(decodeURIComponent(buf).substring(8));

  if (payload.actions[0].value === "refresh") {
    await updateAppHome({
      userId: payload.user.id,
    });
  }
}

async function handleEvent(body) {
  if (!validateTeam(body.team_id)) { return; }
  if (!validateApp(body.api_app_id)) { return; }

  // App Home opened
  if (body.event.type === "app_home_opened"
    && validateAgent(body.event.user)) {
    await updateAppHome({
      userId: body.event.user,
    });
  }
  // Reaction added
  else if (body.event.type === "reaction_added"
    && body.event.item.type === "message"
    && ["white_check_mark", "heavy_check_mark"].includes(body.event.reaction)
    && validateChannel(body.event.item.channel)
    && validateAgent(body.event.user)
    && validateMessageSubtype(body.event.subtype)) {
    await closeIssue({
      channelId: body.event.item.channel,
      threadId: body.event.item.ts,
      agentId: body.event.user,
      closedAt: body.event_time,
    });
    await updateAppHome({
      userId: body.event.user,
    });
  }
  // Reaction removed
  else if (body.event.type === "reaction_removed"
    && body.event.item.type === "message"
    && ["white_check_mark", "heavy_check_mark"].includes(body.event.reaction)
    && validateChannel(body.event.item.channel)
    && validateAgent(body.event.user)
  ) {
    await reopenIssue({
      channelId: body.event.item.channel,
      threadId: body.event.item.ts,
    });
    await updateAppHome({
      userId: body.event.user,
    });
  }
  // New message => new issue
  else if (body.event.type === "message"
    && body.event.channel_type === "channel"
    && body.event.thread_ts === undefined
    && validateChannel(body.event.channel)
    && validateMessageSubtype(body.event.subtype)) {
    await createIssue({
      channelId: body.event.channel,
      threadId: body.event.ts,
      userId: body.event.user,
      text: body.event.text,
      createdAt: body.event_time,
    });
  }
  // New message
  else if (body.event.type === "message"
    && body.event.channel_type === "channel"
    && body.event.thread_ts !== undefined
    && validateChannel(body.event.channel)
    && validateMessageSubtype(body.event.subtype)) {
    await repliedToIssue({
      channelId: body.event.channel,
      threadId: body.event.thread_ts,
      lastMessageId: body.event.ts,
      lastMessageAt: body.event_time,
      lastMessageUserId: body.event.user,
    });

    // If issue is closed => re-open issue
    if (validateNotAgent(body.event.user)) {
      await reopenIssue({
        channelId: body.event.channel,
        threadId: body.event.thread_ts,
      });
    }

    await updateAppHome({
      userId: body.event.user,
    });
  }
}

function validateTeam(teamId) {
  return teamId === TEAM_ID;
}

function validateApp(appId) {
  return appId === APP_ID;
}

function validateChannel(channelId) {
  return CHANNEL_IDS.includes(channelId);
}

function validateAgent(userId) {
  return AGENT_USER_IDS.includes(userId);
}

function validateNotAgent(userId) {
  return !AGENT_USER_IDS.includes(userId);
}

function validateMessageSubtype(subtype) {
  return subtype === undefined || subtype === "file_share";
}

function buildPk(channelId, threadId) {
  return `${channelId}:${threadId}`;
}

async function createIssue({ channelId, threadId, userId, text, createdAt }) {
  await ddb.put({
    TableName: process.env.TABLE_NAME,
    Item: {
      pk: buildPk(channelId, threadId),
      channelId,
      threadId,
      userId,
      text,
      status: STATUS.OPEN,
      createdAt,
      lastMessageId: threadId,
      lastMessageAt: createdAt,
      lastMessageUserId: userId,
    },
  }).promise();
}

async function closeIssue({ channelId, threadId, agentId, closedAt }) {
  await ddb.update({
    TableName: process.env.TABLE_NAME,
    Key: {
      pk: buildPk(channelId, threadId),
    },
    ConditionExpression: 'attribute_exists(pk)',
    UpdateExpression: "SET agentId = :agentId, closedAt = :closedAt, #status = :status",
    ExpressionAttributeNames: {
      "#status": "status",
    },
    ExpressionAttributeValues: {
      ":agentId": agentId,
      ":closedAt": closedAt,
      ":status": STATUS.CLOSED,
    }
  }).promise();
}

async function reopenIssue({ channelId, threadId }) {
  await ddb.update({
    TableName: process.env.TABLE_NAME,
    Key: {
      pk: buildPk(channelId, threadId),
    },
    ConditionExpression: 'attribute_exists(pk)',
    UpdateExpression: "SET #status = :status REMOVE agentId, closedAt",
    ExpressionAttributeNames: {
      "#status": "status",
    },
    ExpressionAttributeValues: {
      ":status": STATUS.OPEN,
    }
  }).promise();
}

async function repliedToIssue({ channelId, threadId, lastMessageId, lastMessageUserId, lastMessageAt }) {
  await ddb.update({
    TableName: process.env.TABLE_NAME,
    Key: {
      pk: buildPk(channelId, threadId),
    },
    ConditionExpression: 'attribute_exists(pk)',
    UpdateExpression: "SET lastMessageId = :lastMessageId, lastMessageAt = :lastMessageAt, lastMessageUserId = :lastMessageUserId",
    ExpressionAttributeValues: {
      ":lastMessageId": lastMessageId,
      ":lastMessageAt": lastMessageAt,
      ":lastMessageUserId": lastMessageUserId,
    }
  }).promise();
}

async function listOpenIssues() {
  const ret = await ddb.query({
    TableName: process.env.TABLE_NAME,
    IndexName: "statusLastMessageAtIndex",
    KeyConditionExpression: "#status = :status",
    ExpressionAttributeNames: {
      "#status": "status",
    },
    ExpressionAttributeValues: {
      ":status": STATUS.OPEN,
    }
  }).promise();

  return ret.Items;
}

async function updateAppHome({ userId }) {
  const issues = await listOpenIssues();
  const args = {
    token: process.env.SLACK_BOT_OAUTH_TOKEN,
    user_id: userId,
    view: await updateView(issues)
  };
  try {
    const result = await axios.post(`${API_URL}/views.publish`, qs.stringify(args));
    console.log(result.data);
  } catch(e) {
    console.log(e);
  }
}

async function renderHeader(text) {
  return {
    type: "header",
    text: {
      type: "plain_text",
      text,
    }
  };
}

async function renderDivider() {
  return [
    { type: "section", text: { type: "plain_text", text: "\n" } },
    { type: "divider" },
    { type: "section", text: { type: "plain_text", text: "\n" } },
  ];
}

async function updateView(issues) {
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "This tool helps the SST team make sure all questions, bug reports, and feature requests are responded and resolved.",
      }
    },
    await renderHeader("How it works"),
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `
- An issue is \`created\` for new messages in #help, #sst, and #seed
- An issue is \`closed\` after a team member marks the thread :white_check_mark: or :heavy_check_mark:
- An issue is \`re-opened\` after a non-team member replies in the thread
`,
      }
    },
    await renderHeader("Unresolved issues"),
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Refresh",
          },
          value: "refresh",
        },
      ],
    },
  ];
  issues.forEach(({ userId, text, channelId, threadId, lastMessageId, lastMessageUserId }, i) => {
    const link = lastMessageId === threadId
      ? `https://serverless-stack.slack.com/archives/${channelId}/p${threadId.split(".").join("")}`
      : `https://serverless-stack.slack.com/archives/${channelId}/p${lastMessageId.split(".").join("")}?thread_ts=${threadId}&cid=${channelId}`;
    blocks.push({
      type: "section",
      text: {
        type: "plain_text",
        text: "\n",
      }
    });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\n<@${userId}> asked in <#${channelId}>: \`${text.replace("\n", " ").substring(0, 70)}\``,
      }
    });
    blocks.push({
      type: "context",
      elements: [
        { type: "mrkdwn", text: `<${link}|View Thread> - Last replied by <@${lastMessageUserId}>` },
      ],
    });
    blocks.push({
      type: "section",
      text: {
        type: "plain_text",
        text: "\n",
      }
    });
    if (i < issues.length - 1) {
      blocks.push({ type: "divider" });
    }
  });

  const view = {
    type: 'home',
    title: {
      type: 'plain_text',
      text: 'Keep note!'
    },
    blocks: blocks
  }

  return JSON.stringify(view);
}
