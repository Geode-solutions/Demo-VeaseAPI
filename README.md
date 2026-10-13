# Demo-VeaseAPI

Demonstrates driving a cloud [Vease](https://vease.geode-solutions.com) instance through its API, the
browser equivalent of Vease's `npm run cloud:load`:

1. A password overlay restricts the demo to people who know the password. Meanwhile the page
   downloads [`data.json`](https://github.com/Geode-solutions/OpenGeode-GeosciencesIO/blob/master/tests/data/data.json).
2. The `/api/login` Nitro route checks the password and logs in to the Geode Cloud API with a
   server-side account. Only the ID token is sent to the browser.
3. The browser starts a Vease instance, opens it in a new tab, waits for that tab to connect and
   loads `data.json` into it through `/api/controller/data/load`.

Closing the Vease tab lets the instance shut down.

## Environment variables

| Variable                   | Purpose                                  |
| -------------------------- | ---------------------------------------- |
| `NUXT_DEMO_PASSWORD`       | Password asked by the overlay            |
| `NUXT_GEODE_USER_EMAIL`    | Geode account used to start the instance |
| `NUXT_GEODE_USER_PASSWORD` | Password of that account                 |

On Netlify, set them in the site's environment variables. Locally, copy `.env.example` to `.env`.

## Development

From the [GeodeWeb-Workspaces](https://github.com/Geode-solutions/GeodeWeb-Workspaces) root, run
`npm install` to link the local OpenGeodeWeb-Front, then in this folder:

```sh
npm run dev
```
