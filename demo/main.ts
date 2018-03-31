// tslint:disable:no-implicit-dependencies
// tslint:disable:import-name
import { Aurelia } from "aurelia-framework";
import { PLATFORM } from "aurelia-pal";
import * as Bluebird from "bluebird";
import env from "./environment";

Promise.config({ warnings: { wForgottenReturn: false } });

export async function configure(au: Aurelia): Promise<void> {
  au.use.standardConfiguration().feature(PLATFORM.moduleName("resources/index"));

  if (env.debug) {
    au.use.developmentLogging();
  }
  if (env.testing) {
    au.use.plugin(PLATFORM.moduleName("aurelia-testing"));
  }
  await au.start();
  await au.setRoot(PLATFORM.moduleName("app"));
}
