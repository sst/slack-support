import {
  isIssueClosed,
  createIssue,
  removeIssue,
  muteIssue,
  closeIssue,
  reopenIssue,
  repliedToIssue,
  listOpenIssues,
} from "./db";
import {
  openModalView,
  publishHomeView,
} from "./slack";

const TEAM_ID = process.env.SLACK_TEAM_ID;
const APP_ID = process.env.SLACK_APP_ID;
const CHANNEL_IDS = process.env.SLACK_CHANNEL_IDS.split(",");
const AGENT_USER_IDS = process.env.SLACK_AGENT_USER_IDS.split(",");

///////////////////////
// Endpoint Handlers //
///////////////////////

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

  console.log(JSON.stringify(payload, null, 4));

  if (payload.type === "block_actions" && payload.actions[0].value === "refresh") {
    await updateAppHome({
      userId: payload.user.id,
    });
  }
  else if (payload.type === "message_action" && payload.callback_id === "create_github_issue") {
    await openModalView({
      channelId: payload.channel.id,
      threadId: payload.message.thread_ts || payload.message.ts,
      messageId: payload.message.ts,
      message: payload.message.text,
      triggerId: payload.trigger_id,
    });
  }

  return { };
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
    && validateChannel(body.event.item.channel)
    && validateAgent(body.event.user)
    && validateMessageSubtypeAdded(body.event.subtype)) {

    if (["white_check_mark", "heavy_check_mark"].includes(body.event.reaction)) {
      await closeIssue({
        channelId: body.event.item.channel,
        threadId: body.event.item.ts,
        agentId: body.event.user,
        closedAt: body.event_time,
      });
    }
    else if (body.event.reaction === "speech_balloon") {
      await muteIssue({
        channelId: body.event.item.channel,
        threadId: body.event.item.ts,
        agentId: body.event.user,
        mutedAt: body.event_time,
      });
    }

    await updateAppHome({
      userId: body.event.user,
    });
  }
  // Reaction removed
  else if (body.event.type === "reaction_removed"
    && body.event.item.type === "message"
    && validateChannel(body.event.item.channel)
    && validateAgent(body.event.user)
  ) {
    if (["white_check_mark", "heavy_check_mark", "speech_balloon"].includes(body.event.reaction)) {
      await reopenIssue({
        channelId: body.event.item.channel,
        threadId: body.event.item.ts,
      });
    }

    await updateAppHome({
      userId: body.event.user,
    });
  }
  // New thread => new issue
  else if (body.event.type === "message"
    && body.event.channel_type === "channel"
    && body.event.thread_ts === undefined
    && validateChannel(body.event.channel)
    && validateMessageSubtypeAdded(body.event.subtype)) {
    await createIssue({
      channelId: body.event.channel,
      threadId: body.event.ts,
      userId: body.event.user,
      text: body.event.text,
      createdAt: body.event_time,
    });
  }
  // New thread reply
  else if (body.event.type === "message"
    && body.event.channel_type === "channel"
    && body.event.thread_ts !== undefined
    && validateChannel(body.event.channel)
    && validateMessageSubtypeAdded(body.event.subtype)) {
    await repliedToIssue({
      channelId: body.event.channel,
      threadId: body.event.thread_ts,
      lastMessageId: body.event.ts,
      lastMessageAt: body.event_time,
      lastMessageUserId: body.event.user,
    });

    // If issue is closed => re-open issue
    if (validateNotAgent(body.event.user)) {
      const isClosed = await isIssueClosed({
        channelId: body.event.channel,
        threadId: body.event.thread_ts,
      });
      if (isClosed) {
        await reopenIssue({
          channelId: body.event.channel,
          threadId: body.event.thread_ts,
        });
      }
    }

    await updateAppHome({
      userId: body.event.user,
    });
  }
  // Removed thread
  else if (body.event.type === "message"
    && body.event.channel_type === "channel"
    && body.event.previous_message.thread_ts === undefined
    && validateChannel(body.event.channel)
    && validateMessageSubtypeDeleted(body.event.subtype)) {
    await removeIssue({
      channelId: body.event.channel,
      threadId: body.event.deleted_ts,
    });
  }
}

async function updateAppHome({ userId }) {
  const issues = await listOpenIssues();
  await publishHomeView({ userId, issues });
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

function validateMessageSubtypeAdded(subtype) {
  return subtype === undefined || subtype === "file_share";
}

function validateMessageSubtypeDeleted(subtype) {
  return subtype === "message_deleted";
}
