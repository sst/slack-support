import {
  createIssue,
  removeIssue,
  closeIssue,
  reopenIssue,
  repliedToIssue,
  listOpenIssues,
} from "./db";
import { publishView } from "./slack";

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
    && validateMessageSubtypeAdded(body.event.subtype)) {
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
      await reopenIssue({
        channelId: body.event.channel,
        threadId: body.event.thread_ts,
      });
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
  await publishView({ userId, issues });
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
