import { RemovalPolicy } from "@aws-cdk/core";
import MainStack from "./MainStack";

export default function main(app) {
  // Destroy all AWS resources when removing app in non-Production stages
  if (app !== "prod") {
    app.setDefaultRemovalPolicy(RemovalPolicy.DESTROY);
  }

  // Set runtime for all functions in the app
  app.setDefaultFunctionProps({
    runtime: "nodejs14.x"
  });

  new MainStack(app, "my-stack");
}
