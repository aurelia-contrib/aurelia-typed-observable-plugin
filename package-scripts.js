const { concurrent, copy, crossEnv, rimraf, series } = require("nps-utils");

function config(name) {
  return `configs/tsconfig-${name}.json`;
}

function tsc(tsconfig) {
  return package(`tsc --project ${config(tsconfig)}`);
}

function webpack(tool, arg) {
  return crossEnv(`TS_NODE_PROJECT=\"${config("webpack")}\" ${tool} --config webpack.config.ts ${arg}`);
}

function package(script) {
  return crossEnv(`./node_modules/.bin/${script}`);
}

function karma(single, watch, browsers, transpileOnly, noInfo, coverage, tsconfig, logLevel, devtool) {
  return package(
    "karma start"
      .concat(single !== null ? ` --single-run=${single}` : "")
      .concat(watch !== null ? ` --auto-watch=${watch}` : "")
      .concat(browsers !== null ? ` --browsers=${browsers}` : "")
      .concat(transpileOnly !== null ? ` --transpile-only=${transpileOnly}` : "")
      .concat(noInfo !== null ? ` --no-info=${noInfo}` : "")
      .concat(coverage !== null ? ` --coverage=${coverage}` : "")
      .concat(tsconfig !== null ? ` --tsconfig=${tsconfig}` : "")
      .concat(logLevel !== null ? ` --log-level=${logLevel}` : "")
      .concat(devtool !== null ? ` --devtool=${devtool}` : "")
  );
}

function release(version, dry) {
  /**
   * Dry prevents anything irreversible from happening.
   * It will do pretty much do the same thing except it won't push to git or publish to npm.
   * Just remember to "unbump" the version in package.json after a dry run (see explanation below)
   */
  const variant = dry ? "dry" : "default";
  return {
    default: series.nps(
      `release.${version}.${variant}.before`,
      `release.${version}.${variant}.version`,
      `release.${version}.${variant}.after`
    ),
    before: series.nps(
      `release.${version}.${variant}.build`,
      `release.${version}.${variant}.bump`,
      `release.${version}.${variant}.git.stage`
    ),
    after: series.nps(`release.${version}.${variant}.git.push`, `release.${version}.${variant}.npm.publish`),
    bump: crossEnv(`npm --no-git-tag-version version ${version}`),
    /**
     * Normally, standard-version looks for certain keywords in the commit log and automatically assigns
     * major/minor/patch based on the contents of those logs.
     *
     * --first-release disables that behavior and does not change the version, which allows us to manually
     * decide the version and bump it with npm version (see right above) instead.
     *
     * The downside is that we have to bump the version in package.json even in a dry run, because
     * standard-version wouldn't report what it would do otherwise.
     *
     * Therefore, always remember to manually "unbump" the version number in package.json after doing a dry run!
     * If you forget this, you'll end up bumping the version twice which gives you one release without changes.
     */
    version: `standard-version --first-release --commit-all${dry ? " --dry-run" : ""}`,
    build: series.nps("test", "build.dist"),
    git: {
      stage: "git add package.json dist",
      push: `git push --follow-tags origin master${dry ? " -n" : ""}`
    },
    npm: {
      publish: `npm ${dry ? "pack" : "publish"}`
    }
  };
}

module.exports = {
  scripts: {
    lint: package(`tslint --project ${config("build")}`),
    test: {
      default: package("nps test.single"),
      single: karma(true, false, "ChromeHeadless", true, true, true, config("test"), null, null),
      watch: {
        default: package("nps test.watch.dev"),
        dev: karma(false, true, "ChromeHeadless", true, true, true, config("test"), null, null),
        debug: karma(false, true, "ChromeDebugging", true, false, null, config("test"), "debug", null)
      }
    },
    build: {
      demo: {
        default: "nps build.demo.development",
        development: {
          default: webpack("webpack-dev-server", "--hot --env.server")
        },
        production: {
          default: webpack("webpack", "--env.production")
        }
      },
      dist: {
        default: series.nps("build.dist.before", "build.dist.all"),
        before: series.nps("lint", "build.dist.clean"),
        all: "npm run rollup",
        clean: rimraf("dist"),
      }
    },
    release: {
      patch: {
        default: release("patch"),
        dry: release("patch", true)
      },
      minor: {
        default: release("minor"),
        dry: release("minor", true)
      },
      major: {
        default: release("major"),
        dry: release("major", true)
      }
    },
    /**
     * Make sure to run "npm run ghpages-setup" before "npm run ghpages" the very first time,
     * or manually create the gh-pages branch and set the remote.
     *
     * There is no dry run variant for this because it's not really that harmful if the demo page goes bad
     * and it doesn't affect the master branch.
     */
    ghpages: {
      default: series(
        "git checkout gh-pages",
        "git merge master --no-edit",
        rimraf("*.bundle.js"),
        package("nps build.demo.production"),
        "git add index.html *.bundle.js",
        'git commit -m "doc(demo): build demo"',
        "git push",
        "git checkout master"
      ),
      setup: series(
        "git checkout -b gh-pages",
        "git --set-upstream origin gh-pages"
      )
    }
  }
};
