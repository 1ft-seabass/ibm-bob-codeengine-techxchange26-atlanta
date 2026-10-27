# IBM Code Engine Deploy Infrastructure — Setup Guide

This file is a standalone setup guide for building a Node.js (Hono) + IBM Cloud Code Engine web application deployment infrastructure in a new repository and a new project.
It is written to be self-contained — no other documents need to be referenced.

## What This Guide Creates

- A Node.js web server using the Hono framework (static file serving + API)
- Everything needed to containerize it as a Docker image and run it on IBM Cloud Code Engine
- A workflow where GitHub is used directly as the build source, so builds and deployments complete using only the `ibmcloud` CLI
- A setup that reduces day-to-day updates to just two steps: `git push` → `npm run build`

Frontend technology choices (e.g. introducing Vue) are out of scope for this guide.
The priority here is to get a plain HTML + server running first; the frontend can be swapped in later.

## Prerequisites

- `ibmcloud` CLI is installed and you are logged in
- The `code-engine` plugin is installed via `ibmcloud plugin install code-engine`
- An IBM Cloud Code Engine **project already exists** at the deployment target
  (Only if no project exists, create one with `ibmcloud ce project create --name <PROJECT_NAME>`)
- The source GitHub repository is set up as a **public repository**
  (For private repositories, `--build-source` alone cannot authenticate;
  additional access token configuration is required, which is outside the scope of this guide)

## Steps

### 1. Create the Server

Add the following to `package.json`:

```json
{
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "@hono/node-server": "^1.0.0"
  }
}
```

Create `server.js`:

```js
const { Hono } = require('hono');
const { serve } = require('@hono/node-server');
const { serveStatic } = require('@hono/node-server/serve-static');

const app = new Hono();

app.use('/*', serveStatic({ root: './public' }));

app.get('/api/hello', (c) => {
  return c.json({ message: 'Hello from Hono!' });
});

// IBM Code Engine automatically sets the PORT environment variable in the container,
// so always use process.env.PORT as the priority.
const port = process.env.PORT || 8080;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`app listening at http://localhost:${info.port}`);
});
```

Place at least one static page at `public/index.html` (content is flexible — just enough to verify it works).

### 2. Create the Dockerfile

```dockerfile
FROM icr.io/codeengine/node:22-alpine
COPY package.json .
RUN npm install
RUN mkdir public
COPY public/ public/
COPY server.js .
EXPOSE 8080
CMD [ "node", "server.js" ]
```

Note: `npm install` also installs `devDependencies`. To slim down the production image,
change it to `RUN npm install --omit=dev` (especially recommended when devDependencies
include tools like security checkers that are not needed at runtime).

### 3. Push the Repository

**Code Engine builds directly from the GitHub repository, so simply committing locally is not enough.
Always `git push` first to make sure the Dockerfile exists on the remote before proceeding.**
Running a build before pushing will fail with an error equivalent to `Dockerfile not found`.

```bash
git push origin main
```

### 4. Select the Code Engine Project

```bash
ibmcloud target -g default
ibmcloud ce project select --name <PROJECT_NAME>
```

### 5. Create the Application (Build + Deploy in One Step)

```bash
ibmcloud ce application create \
  --name <APP_NAME> \
  --build-source https://github.com/<owner>/<repo> \
  --build-strategy dockerfile \
  --build-size medium \
  --port 8080 \
  --wait
```

Adding `--wait` makes the command wait until the build completes and the app starts, then returns the public URL.

Option name note: `application create` uses `--build-source`.
The standalone `ibmcloud ce build create` command uses `--source` for the same concept — the names differ,
so sticking to `application create` avoids confusion.

### 6. Verify the Deployment

```bash
curl https://<output URL>/
curl https://<output URL>/api/hello
```

You can also check the application status (URL, current image, running state) with:

```bash
ibmcloud ce application get --name <APP_NAME>
```

If the build fails, check the build logs and events:

```bash
ibmcloud ce buildrun get --name <APP_NAME>
ibmcloud ce build events --build <BUILD_NAME>
```

Only if these commands don't give enough information, open the Code Engine page in the IBM Cloud console
for a visual check (it's not required).

### 7. Set Up the Day-to-Day Update Workflow

Create a file called `.env.ce` and add it to `.gitignore` (exclude it from Git):

```bash
CE_BUILD_NAME=<build name auto-generated when application create ran; check with ibmcloud ce build list>
CE_APP_NAME=<APP_NAME>
CE_BUILD_IMAGE=private.<region>.icr.io/<ICR_NAMESPACE>/build-<CE_BUILD_NAME>:latest
```

Install `dotenv-cli` and add the following to `package.json`:

```json
{
  "scripts": {
    "build:image_build": "dotenv -e .env.ce -- ibmcloud ce buildrun submit --build $CE_BUILD_NAME --wait",
    "build:update_app": "dotenv -e .env.ce -- ibmcloud ce application update --name $CE_APP_NAME --image $CE_BUILD_IMAGE --wait",
    "build": "npm run build:image_build && npm run build:update_app"
  }
}
```

From this point on, all updates require only these two steps:

```bash
git push origin main
npm run build
```

## Operational Notes (Common Pitfalls)

- **Don't confuse image types**: The `app-<APP_NAME>:<timestamp>` image generated by `application create`
  and the `build-<CE_BUILD_NAME>:latest` image generated by `buildrun submit` are different.
  When cleaning up the container registry, deleting the `app-*` tagged image that the running app
  references will cause the app to become unreachable (404). Only `build-*:latest` needs to be kept.
- **Multiple apps can coexist in one project**: When adding a new app, there is no need to recreate
  the project. Just select the existing project with `ibmcloud ce project select` and start from step 5.
  Note that the ICR namespace is shared within a project, so images accumulate as more apps are added.
- **Do not hardcode sensitive values in the repository**: ICR internal URLs and project-specific names
  should be extracted into `.env.ce` (excluded from Git); `package.json` scripts should only reference
  environment variables. This keeps the repository reusable as a base for other projects.

## Completion Criteria

- Both the top page and `/api/hello` respond with HTTP 200 via `curl`
- `.env.ce` has all three values set and is excluded from Git
- Running `npm run build` alone is sufficient to redeploy
