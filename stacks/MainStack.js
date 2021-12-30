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
        },
        permissions: [table],
      },
      routes: {
        "POST /subscription": "src/lambda.subscription",
      },
    });

    // Show the endpoint in the output
    this.addOutputs({
      "ApiEndpoint": api.url,
    });
  }
}
