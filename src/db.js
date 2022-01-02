import AWS from "aws-sdk";
if (process.env.IS_LOCAL) {
  AWS.config.logger = console;
}

const ddb = new AWS.DynamoDB.DocumentClient();

const TableName = process.env.TABLE_NAME;
const Status = {
  OPEN: "open",
  CLOSED: "closed",
};

export async function createIssue({ channelId, threadId, userId, text, createdAt }) {
  await ddb.put({
    TableName,
    Item: {
      pk: buildPk(channelId, threadId),
      channelId,
      threadId,
      userId,
      text,
      status: Status.OPEN,
      createdAt,
      lastMessageId: threadId,
      lastMessageAt: createdAt,
      lastMessageUserId: userId,
    },
  }).promise();
}

export async function removeIssue({ channelId, threadId }) {
  await ddb.delete({
    TableName,
    Key: {
      pk: buildPk(channelId, threadId),
    },
  }).promise();
}

export async function closeIssue({ channelId, threadId, agentId, closedAt }) {
  await ddb.update({
    TableName,
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
      ":status": Status.CLOSED,
    }
  }).promise();
}

export async function reopenIssue({ channelId, threadId }) {
  await ddb.update({
    TableName,
    Key: {
      pk: buildPk(channelId, threadId),
    },
    ConditionExpression: 'attribute_exists(pk)',
    UpdateExpression: "SET #status = :status REMOVE agentId, closedAt",
    ExpressionAttributeNames: {
      "#status": "status",
    },
    ExpressionAttributeValues: {
      ":status": Status.OPEN,
    }
  }).promise();
}

export async function repliedToIssue({ channelId, threadId, lastMessageId, lastMessageUserId, lastMessageAt }) {
  await ddb.update({
    TableName,
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

export async function listOpenIssues() {
  const ret = await ddb.query({
    TableName,
    IndexName: "statusLastMessageAtIndex",
    KeyConditionExpression: "#status = :status",
    ExpressionAttributeNames: {
      "#status": "status",
    },
    ExpressionAttributeValues: {
      ":status": Status.OPEN,
    }
  }).promise();

  return ret.Items;
}

function buildPk(channelId, threadId) {
  return `${channelId}:${threadId}`;
}
