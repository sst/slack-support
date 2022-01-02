import qs from "qs";
import axios from "axios";

const ApiURL = "https://slack.com/api";

export async function publishView({ userId, issues }) {
  const args = {
    token: process.env.SLACK_BOT_OAUTH_TOKEN,
    user_id: userId,
    view: await renderView(issues)
  };
  try {
    const result = await axios.post(`${ApiURL}/views.publish`, qs.stringify(args));
    console.log(result.data);
  } catch(e) {
    console.log(e);
  }
}

async function renderView(issues) {
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
