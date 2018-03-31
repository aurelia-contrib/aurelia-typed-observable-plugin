# aurelia-skeleton-plugin-ts-webpack

A plugin skeleton that utilizes `nps` to fully automate the release process.

Optimized for development in Visual Studio Code.

# 1. Initial setup

## 1.0 (optional) Do a test run

-  Follow all steps below, but with a throwaway plugin name and `npm unpublish` + delete the github repository after you've tried out the process

## 1.1 Make it yours

- `git clone https://github.com/fkleuver/aurelia-plugin-skeleton-ts-webpack your-plugin-name`
- Replace all "aurelia-plugin-skeleton-ts-webpack" with the name of your plugin/repo
- Rename the `aurelia-plugin-skeleton-ts-webpack.ts` file to the name of your plugin
- Update the `description`, `keywords`, `author`, `bugs.url` and `repository.url` fields in `package.json`
- Update the `LICENSE` file with your own name

## 1.2 Create the repository

- Create a new repository on github
- (optional) remove the .git directory and initialize a fresh, new git repo without my commit history
- Set the remote tracking branch and push your master branch
- Run `npm run ghpages-setup` (see bottom of package-scripts.js for clarification on what that does)

# 2. Developing

## 2.1 Initialize

- `yarn install` (or `npm install`, but I find yarn to give less friction overall)
- Reopen the folder (if you're working in vs code) to properly initialize typescript

## 2.2 Start the watchers

There are two ways to test your code, and you can (as I often do) run them simultaneously. This gives you plenty of means to develop your plugin in small, simple steps while constantly being able to test and verify your code.

### 2.2.1 Run karma

From the project root:
- `npm run test-watch` to start karma (will run Chrome in Headless mode)

- Go to the `coverage` folder and open `index.html` in a browser to see your test coverage (refresh to update)

Tip: the code coverage page allows you to drill down into your code and see exactly which parts are covered by tests. Great for helping you to decide what tests you should write.

### 2.2.2 Run the demo

Also from the project root, from another command prompt:
- `npm run demo-dev` to start the webpack dev server for the demo page

While the demo page is first and foremost meant to be a live running example where users can see the plugin in action, it's also useful as a manual end-to-end test and to quickly try some new stuff.

## 2.2 Develop

- Add a file and write some code
- Add a file with the same name + `.spec` under `test/unit`

You get the idea :-)

## 2.3 Debug

### 2.3.1 Start the test runner in debug mode

- `npm run test-debug` (you'll now get more verbose logging output in the console)

### 2.3.2 Open the debug window in CHrome

- In Chrome, press the `DEBUG` button to open the debugging window

Here you can see any script errors in the console

### 2.3.3 Debug your test in VS Code


- Start the VS Code debugger and pick "Attach Karma Chrome"
- Attach to the DEBUG window
- Set a breakpoint
- Refresh the DEBUG window in chrome
- Your breakpoint should get hit

A few notes on debugging in VS Code:

Debugging in VS Code can be a bit quirky sometimes, especially with async code. The problem mainly has to do with webpack and source maps. We've recently had 4.0 and the plugin ecosystem hasn't quite caught up yet.

When you can't step into, over or out of certain code (e.g. the debugger jumps to the start of a file and stays there) that doesn't mean you can't debug that code. You'll just need to set a breakpoint closer to the part you want to inspect.

Source maps also don't seem to update when you change code in debug mode, so after changing a few lines of code you may find the debugger completely refusing to co-operate. Just restart `npm run test-debug`, refresh again and it should work.


# 3 Releasing

## 3.0 Setup NPM publishing

- If you don't have an account already - create one, and authenticate locally so that the release script can `npm publish`


## 3.1 (optional) Verify

- `npm run test` to run all tests once
- `npm run lint` to get surprised with what typescript thinks of your code
- `npm run demo-prod` to double check the demo still works


## 3.2 Release

There is a `patch`, `minor` and `major` variant of the release script. The examples below will use `patch`, but the same applies for the other two.

### 3.2.0 Commit your changes

Please make sure the working directory is "clean" in git's terms.

### 3.2.1 (optional) Do a dry run

A dry run will execute the normal process of running tests and building your code, but will **not** commit, push to git or publish to npm. It **will** make modifications to your local files (the build output and package.json). These are easy to undo however.

- `npm run release-patch-dry`

Verify that no crazy things would happen, and undo the changes.

### 3.2.2 Actually release

- `npm run release-patch`

That's equivalent to the following (with node_modules subpaths and TS_NODE_PROJECT assignment omitted for brevity):

1. `karma start --single-run=true --auto-watch=false --browsers=ChromeHeadless --transpile-only=true --no-info=true --coverage=true --tsconfig=configs/tsconfig-test.json`
2. `tslint --project configs/tsconfig-build.json`
3. `rimraf dist`
4. concurrently:
    - `tsc --project configs/tsconfig-build-amd.json`
    - `tsc --project configs/tsconfig-build-commonjs.json`
    - `tsc --project configs/tsconfig-build-es2017.json`
    - `tsc --project configs/tsconfig-build-es2015.json`
    - `tsc --project configs/tsconfig-build-native-modules.json`
    - `tsc --project configs/tsconfig-build-system.json`
5. `npm --no-git-tag-version version patch` (bumps the version number in package.json)
6. `git add package.json dist`
7. `standard-version --first-release --commit-all` (adds changes to changelog, git tags to current version and commits those changes)
8. `git push --follow-tags origin master`
9. `npm publish`

### 3.2.3 Update github pages

- `npm run ghpages`

That's equivalent to the following:

1. `git checkout gh-pages`
2. `git merge master --no-edit`
3. `rimraf *.bundle.js`
4. `webpack --env.production`
5. `git add index.html *.bundle.js`
6. `git commit -m "doc(demo): build demo"`
7. `git push`
8. `git checkout master`

And there you have it, one-click release :-)
