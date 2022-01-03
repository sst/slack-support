import qs from "qs";
import axios from "axios";

const SlackURL = `https://${process.env.SLACK_TEAM_NAME}.slack.com`;
const SlackApiURL = "https://slack.com/api";
const GitHubURL = `https://github.com/${process.env.GITHUB_REPO}`;

export async function publishHomeView({ userId, issues }) {
  const args = {
    token: process.env.SLACK_BOT_OAUTH_TOKEN,
    user_id: userId,
    view: await renderHomeView(issues)
  };
  try {
    const result = await axios.post(`${SlackApiURL}/views.publish`, qs.stringify(args));
    console.log(result.data);
  } catch(e) {
    console.log(e);
  }
}

export async function openModalView({ triggerId, channelId, threadId, messageId, message }) {
  const args = {
    token: process.env.SLACK_BOT_OAUTH_TOKEN,
    trigger_id: triggerId,
    view: await renderModalView({ channelId, threadId, messageId, message })
  };
  try {
    const result = await axios.post(`${SlackApiURL}/views.open`, qs.stringify(args));
    console.log(result.data);
  } catch(e) {
    console.log(e);
  }
}

async function renderModalView({ channelId, threadId, messageId, message }) {
  const link = buildSlackLink({ channelId, threadId, messageId });
  const quotedMessage = message.split("\n").map(line => `> ${line}`).join("\n");
  const body = encodeURIComponent(`\n\n${quotedMessage}\n\n---\nRequest: ${link}`);
  return JSON.stringify({
    type: "modal",
    callback_id: "modal-create-github-issue",
    title: {
      type: 'plain_text',
      text: 'Create a GitHub Issue'
    },
    blocks: [{
      type: "actions",
      elements: [{
        type: "button",
        text: {
          type: "plain_text",
          text: "Open in GitHub",
        },
        url: `${GitHubURL}/issues/new?body=${body}`,
        action_id: "button-create-github-issue",
      }],
    }],
  });
}

async function renderHomeView(issues) {
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
    const link = buildSlackLink({
      channelId,
      threadId,
      messageId: lastMessageUserId,
    });
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

function buildSlackLink({ channelId, threadId, messageId }) {
  return messageId === threadId
    ? `${SlackURL}/archives/${channelId}/p${threadId.split(".").join("")}`
    : `${SlackURL}/archives/${channelId}/p${messageId.split(".").join("")}?thread_ts=${threadId}&cid=${channelId}`;
}
