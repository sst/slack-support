# SST Support Slack Bot [![Seed Status](https://api.seed.run/anomaly/sst-slack-support/stages/prod/build_badge)](https://console.seed.run/anomaly/sst-slack-support)

A serverless app created with [SST](https://github.com/serverless-stack/serverless-stack) that helps the SST team make sure all questions in the Slack channel are answered.

## Getting Started

[Create a Slack app](https://api.slack.com/apps), and read this guide on how to enable Event Subscriptions webhook — [Slack Event Subscriptions](https://api.slack.com/apis/connections/events-api#the-events-api__subscribing-to-event-types).

## Running Locally

Create a `.env.local` file and add the Slack Bot OAuth token.

```
SLACK_BOT_OAUTH_TOKEN=xoxb-1111111111111-2222222222222-zI2HCwkNaoXaNnd1JKlzcBl9
```

Start by installing the dependencies.

``` bash
$ npm install
```

Then start the Live Lambda Development environment.

``` bash
$ npx sst start
```

The templates to generate the share images are stored in [`templates/`](https://github.com/serverless-stack/social-cards/tree/main/templates). And all the non-Latin fonts are placed in [`.fonts/`](https://github.com/serverless-stack/social-cards/tree/main/.fonts).

## Deploying to Prod

Deploy your service to prod by running.

``` bash
$ npx sst deploy --stage prod
```

## Documentation

Learn more about the SST.

- [Docs](https://docs.serverless-stack.com/)
- [@serverless-stack/cli](https://docs.serverless-stack.com/packages/cli)
- [@serverless-stack/resources](https://docs.serverless-stack.com/packages/resources)
