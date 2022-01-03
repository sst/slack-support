import * as sst from "@serverless-stack/resources";

export default class MainStack extends sst.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Create a Table to store issues
    const table = new sst.Table(this, "Objects", {
      fields: {
        pk: sst.TableFieldType.STRING,
        status: sst.TableFieldType.STRING,
        lastMessageAt: sst.TableFieldType.NUMBER,
      },
      primaryIndex: { partitionKey: "pk" },
      globalIndexes: {
        statusLastMessageAtIndex: { partitionKey: "status", sortKey: "lastMessageAt" },
      },
    });

    // Create an API
    const api = new sst.Api(this, "Api", {
      defaultFunctionProps: {
        environment: {
          TABLE_NAME: table.tableName,
          SLACK_BOT_OAUTH_TOKEN: process.env.SLACK_BOT_OAUTH_TOKEN,
          SLACK_APP_ID: process.env.SLACK_APP_ID,
          SLACK_TEAM_ID: process.env.SLACK_TEAM_ID,
          SLACK_TEAM_NAME: process.env.SLACK_TEAM_NAME,
          SLACK_CHANNEL_IDS: process.env.SLACK_CHANNEL_IDS,
          SLACK_AGENT_USER_IDS: process.env.SLACK_AGENT_USER_IDS,
          GITHUB_REPO: process.env.GITHUB_REPO,
        },
        permissions: [table],
      },
      routes: {
        "POST /subscription": "src/lambda.subscription",
        "POST /interactive": "src/lambda.interactive",
      },
    });

    // Show the endpoint in the output
    this.addOutputs({
      "ApiEndpoint": api.url,
    });
  }
}
