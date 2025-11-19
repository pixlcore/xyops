# SSO Overview

Single Sign-On (SSO) is a mechanism for outsourcing the xyOps user authentication to a third party identity provider, such as Microsoft, Google, GitHub, Okta, Auth0, Cognito, etc.  This document outlines the SSO implementation in xyOps, including configuration, usage, and best practices.

Configuring SSO is a complex, highly technical process that requires careful coordination between identity providers, certificates, middleware, and application settings.  It is easy to get things wrong and expose security holes in your system.  While we provide all necessary documentation here, we strongly recommend our [Enterprise Plan](https://xyops.io/enterprise). This gives you access to our white-glove onboarding service, where our team will guide you through every step, validate your configuration, and ensure your integration is both secure and reliable.  This also gets you priority ticket support, and live chat support from a xyOps engineer.

xyOps uses the "trusted headers" implementation for SSO, allowing for easy integration with several authentication tools and middlewares.  These include [OAuth2-Proxy](https://github.com/oauth2-proxy/oauth2-proxy), [Vouch](https://github.com/vouch/vouch-proxy), [Authelia](https://github.com/authelia/authelia), and [Authentik](https://github.com/goauthentik/authentik), among others.  It also supports [Tailscale](https://tailscale.com/) (i.e. [Tailscale Serve](https://tailscale.com/kb/1312/serve)) which forwards headers in the same way.

The trusted header flow works as follows:

1. The authentication tool sits in front, and redirects the user to the identity provider as needed.
	- Some of these auth tools can also provide SSL termination for you, or be used in combination with a proxy such as [Nginx](https://nginx.org/) for SSL.
2. Once the user is authenticated, the tool forwards the request to xyOps and includes a set of special "trusted headers".
3. xyOps detects the headers and creates/updates a user account as necessary, and logs the user in using its own session system.
	- xyOps can also automatically assign user roles and/or privileges based on groups you define in your identity provider.

# Setup

The first step is to pick an authentication tool, and get it all configured and working before we throw xyOps in the mix.  We'll focus on [OAuth2-Proxy](https://github.com/oauth2-proxy/oauth2-proxy) for this guide, as it is extremely quick and easy to get up and running.  It is also free, open source, and supports all the major OIDC providers (SAML is covered separately below).

You can follow their [installation guide](https://oauth2-proxy.github.io/oauth2-proxy/installation), or use the following [Docker Compose](https://docs.docker.com/compose/) configuration with a generic OIDC provider as a starting point:

```yaml
services:
  oauth2-proxy:
    image: quay.io/oauth2-proxy/oauth2-proxy:latest
    ports: ["4180:4180"]
    environment:
      OAUTH2_PROXY_PROVIDER: "oidc"
      OAUTH2_PROXY_OIDC_ISSUER_URL: "https://_YOUR_OIDC_ISSUER_URL_/"
      OAUTH2_PROXY_CLIENT_ID: "_YOUR_CLIENT_ID_"
      OAUTH2_PROXY_CLIENT_SECRET: "_YOUR_CLIENT_SECRET_"
      OAUTH2_PROXY_REDIRECT_URL: "http://localhost:4180/oauth2/callback"
      OAUTH2_PROXY_SCOPE: "openid profile email"
      OAUTH2_PROXY_COOKIE_SECRET: "_YOUR_COOKIE_SECRET_"
      OAUTH2_PROXY_EMAIL_DOMAINS: "*" 
      OAUTH2_PROXY_UPSTREAMS: "http://echo-server:80"
      OAUTH2_PROXY_HTTP_ADDRESS: "0.0.0.0:4180"
      OAUTH2_PROXY_COOKIE_SECURE: "false" # for dev testing
      OAUTH2_PROXY_PASS_USER_HEADERS: "true" # sends X-Forwarded-User/Email/etc
      OAUTH2_PROXY_SET_AUTHORIZATION_HEADER: "true" # forwards Bearer in Authorization if present
      OAUTH2_PROXY_PASS_ACCESS_TOKEN: "true" # forward access token if present
      OAUTH2_PROXY_SKIP_PROVIDER_BUTTON: "true" # skip splash screen
	  OAUTH2_PROXY_SKIP_AUTH_ROUTES: "^/(api|health|images|js|css|fonts|sounds|codemirror|manifest.webmanifest)(/|$)" # skip auth for static files

  echo-server:
    image: ealen/echo-server
```

Notice how this docker compose actually starts *two* separate containers: the OAuth2-Proxy itself, and also something called [echo-server](https://hub.docker.com/r/ealen/echo-server).  The latter is a simple passthrough web server for testing, which echoes request metadata back to the browser in JSON format.  This is extremely useful for the initial SSO setup process, because you can test your auth implementation *in isolation*, and see exactly which headers will be passed down to the app after authentication (we'll need to map these headers to standard fields in xyOps, which is covered below).

Check out the [OAuth2-Proxy configuration docs](https://oauth2-proxy.github.io/oauth2-proxy/configuration/overview/) for details on all the environment variables used above.  OAuth2-Proxy also provides a set of [example setup files](https://github.com/oauth2-proxy/oauth2-proxy/tree/master/contrib/local-environment) which are quite useful for specific configurations.

Note that OAuth2-Proxy has [specific instructions for certain providers](https://oauth2-proxy.github.io/oauth2-proxy/configuration/providers/) including GitHub, Google, Microsoft, and others, so if you are using one of those identity providers please read the appropriate section for specific setup steps.

Once you have the docker containers up and running, hit this URL in your browser:

```
http://localhost:4180/
```

This should first redirect you to log in using your identity provider.  Once you log in successfully, it should forward the authenticated request to the backend `echo-server` container (running alongside OAuth2-Proxy), and echo back the request information to the browser in JSON format, including the request headers.  You should see something like this on your screen (pretty-printed):

```json
{
	"host": {
		"hostname": "localhost",
		"ip": "::ffff:192.168.148.2",
		"ips": []
	},
	"http": {
		"method": "GET",
		"baseUrl": "",
		"originalUrl": "/",
		"protocol": "http"
	},
	"request": {
		"query": {},
		"cookies": {
			"_oauth2_proxy": "2F5DmA84rnYAoZi********pym6VyPzhVj4zU58w="
		},
		"body": {},
		"headers": {
			"host": "localhost:4180",
			"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...",
			"accept": "text/html ...",
			"accept-encoding": "gzip, deflate, br, zstd",
			"accept-language": "en-US,en;q=0.9",
			"cookie": "2F5DmA84rnYAoZi********pym6VyPzhVj4zU58w=",
			"x-forwarded-access-token": "gho_C7WF*****3JXT6P",
			"x-forwarded-email": "jhuckaby@gmail.com",
			"x-forwarded-for": "192.168.148.1",
			"x-forwarded-groups": "pixlcore,pixlcore:owners",
			"x-forwarded-user": "jhuckaby"
		}
	},
	"environment": {}
}
```

The important headers we want to see are these three right here:

```
"x-forwarded-email": "jhuckaby@example.com", 
"x-forwarded-groups": "pixlcore,pixlcore:owners", 
"x-forwarded-user": "jhuckaby"
```

These are the magical "trusted headers" that xyOps will use to automatically log in the user (and create/update their user account if necessary).  So, if you are seeing these headers in your test request (or at the very least `x-forwarded-email`), then things are working, and you can swap out `echo-server` for the real xyOps.  But before you do that, proceed to the next section to learn how to configure xyOps for SSO.

# Configuration

All the SSO settings for xyOps are contained in the `/opt/xyops/conf/sso.json` file.  The default configuration looks like this:

```json
{
	"enabled": false,
	"whitelist": ["127.0.0.1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "::1/128", "fd00::/8", "169.254.0.0/16", "fe80::/10"],
	"header_map": {
		"username": "x-forwarded-email",
		"full_name": "x-forwarded-email",
		"email": "x-forwarded-email",
		"groups": "x-forwarded-groups"
	},
	"cleanup_username": true,
	"cleanup_full_name": true,
	"group_role_map": {},
	"group_privilege_map": {},
	"replace_roles": false,
	"replace_privileges": false,
	"admin_bootstrap": "",
	"logout_url": ""
}
```

Here are descriptions of all the SSO properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `enabled` | Boolean | Set this to `true` to enable SSO login (and disable classic user/pass login!). |
| `whitelist` | Array | This allows you to limit the trusted headers mechanism to the proxy that performed the auth.  See [Live Production](#live-production) for more on this. |
| `header_map` | Object | This allows you to map trusted headers to standard xyOps user properties.  See [Header Map](#header-map) below for details. |
| `cleanup_username` | Boolean | Set this to `true` to cleanup the username received from the trusted headers.  See [Header Map](#header-map) below for details. |
| `cleanup_full_name` | Boolean | Set this to `true` to cleanup the user's full name received from the trusted headers.  See [Header Map](#header-map) below for details. |
| `group_role_map` | Object | Automatically assign roles to users based on groups received from the trusted headers.  See [User Groups](#user-groups) below for details. |
| `group_privilege_map` | Object | Automatically assign privileges to users based on groups received from the trusted headers.  See [User Groups](#user-groups) below for details. |
| `replace_roles` | Boolean | Set this to `true` to replace **all** the user's roles with those mapped via `group_role_map` only.  See [User Groups](#user-groups) below for details. |
| `replace_privileges` | Boolean | Set this to `true` to replace **all** the user's privileges with those mapped via `group_role_map` only.  See [User Groups](#user-groups) below for details. |
| `admin_bootstrap` | String | Temporarily assign full administrator privileges to a given user.  This is used for bootstrapping the system on initial setup.  See [Admin Bootstrap](#admin-bootstrap) for more. |
| `logout_url` | String | Set this to the URL to redirect the user to after xyOps performs its own logout.  See [Logging Out](#logging-out) below for details. |

## Header Map

The `header_map` object allows you to define which incoming headers map to which xyOps user properties (username, email, etc.).  The reason we need a map is because all auth middleware tools and identity providers do this a little differently.  Different auth tools use different header names, and some identity providers *only* provide an email address, while some also provide a username, and some also provide groups.  The header map allows for full flexibility in our configuration, so we can support any combination of tools and IdPs.

For example, using OAuth2-Proxy and most OIDC providers, you'll usually get at least a `x-forwarded-email` header.  Some providers also send along a `x-forwarded-user` and, if you enable it in your IdP, you'll get an `x-forwarded-groups` as well.  If you get all three, use a header map setup like this:

```json
"header_map": {
	"username": "x-forwarded-user",
	"full_name": "x-forwarded-user",
	"email": "x-forwarded-email",
	"groups": "x-forwarded-groups"
}
```

However, if you use an identity provider that *only* sends an email address, use something like this:

```json
"header_map": {
	"username": "x-forwarded-email",
	"full_name": "x-forwarded-email",
	"email": "x-forwarded-email"
}
```

In this case we're using the email address as the username, full name, and email.  Here xyOps can help "clean up" the username and full name fields as it extracts them from the user's email address.  See the following section for details on this.

### Header Cleanup

To perform header cleanup, set the `cleanup_username` and/or `cleanup_full_name` properties to `true`.  Here is what each does:

- `cleanup_username` extracts a usable username from an email address.  It does this by grabbing everything up to the `@` symbol, stripping all illegal symbols (anything other than alphanumerics, dots, dashes, periods and underscores), and converting it to lower-case.  For example, `John.Smith@example.com` would become `john.smith`.
	- This assumes all of your users have "company email addresses" and all share the same email domain, so the first part of their email addresses is a viable username.
	- If you would rather use the full email address as the username, set `cleanup_username` to `false`.  This will use the full email address but still convert all illegal symbols to underscores, and lower-case the final result.  In this case `John.Smith@example.com` would become `john.smith_example.com`.
- `cleanup_full_name` extracts a usable display name from an email address.  It does this by grabbing everything up to the `@` symbol, converting periods to spaces, and title-casing each word.  For example, `john.smith@example.com` would become `John Smith`.  Obviously this works best for `first.last` email address formats.
	- If you set `cleanup_full_name` to false the user's full email address will be set to their display name.

These complications are why it's important to first follow the initial [Setup](#setup) step above, where you can test your SSO setup with a pure passthrough echo server, so you can see exactly what fields your IdP sends over, and how your auth middleware maps those fields to request headers.  Armed with this knowledge, you'll know exactly how to configure the `header_map` in xyOps.

## Default User Privileges

When users are first created via SSO, a default set of privileges is applied.  This is configured in the main `/opt/xyops/conf/config.json` file in the [default_user_privileges](config.md#default_user_privileges) property.  The default set is:

```json
"default_user_privileges": {
	"create_events": true,
	"edit_events": true,
	"run_jobs": true,
	"tag_jobs": true,
	"comment_jobs": true
}
```

This is the same set of default privileges applied to new users created manually in the xyOps Admin UI.  These privileges (along with custom user roles) can be further customized by mapping your IdP groups.  See the next section for details.

## User Groups

With `group_role_map` and `group_privilege_map` you can map your own user groups (as defined in your OIDC/SAML identity provider) to user [roles and privileges](privileges.md) on the xyOps side.  Here is how it works.  Imagine a set of incoming trusted headers like these (GitHub IdP used here as an example):

```json
{
    "x-forwarded-email": "jhuckaby@example.com",
    "x-forwarded-groups": "pixlcore,pixlcore:owners",
    "x-forwarded-user": "jhuckaby"
}
```

In this case user `jhuckaby` is a member of two groups: `pixlcore` and `pixlcore:owners`.  Assuming you have the `x-forwarded-groups` header mapped to `groups` via the [Header Map](#header-map), here is how you could assign `pixlcore:owners` so users with this group automatically become a full administrator:

```json
"group_privilege_map": {
	"pixlcore:owners": ["admin"]
}
```

And if you have roles defined in xyOps, you can also map user groups to those, by using the Role IDs.  Example, assuming you have two roles with IDs `r12345` and `r67890`:

```json
"group_role_map": {
	"pixlcore": ["r12345", "r67890"]
}
```

This would apply both roles to all users in the `pixlcore` IdP group.

Now, by default, these roles and privileges are applied "additively" to user records.  Meaning, they will never *remove* a role or privilege.  This is so you can manually apply your own user roles and permissions using the xyOps Admin UI, and everything plays nice.  However, if you do not want this behavior, and instead want your IdP to be the single source of truth for all user roles and privileges, set `replace_roles` and/or `replace_privileges` to true.  Those will replace **all** the roles and/or privileges with whatever we get from the IdP group map.  This sync happens on every user login and session refresh, wiping out any local changes made in xyOps.

Note that not all identity providers send along groups by default.  In many cases you will have to manually enable it in your IdP admin portal.

See [Privileges](privileges.md) for more on xyOps user roles and privileges.

## Admin Bootstrap

For the initial setup and configuration phase, it is often useful to promote yourself to a full administrator.  This comes in handy if your IdP doesn't send along groups, or you haven't yet configured that feature.  To force a single user to be admin, add `admin_bootstrap` and set it to your *exact username*:

```json
"admin_bootstrap": "jhuckaby"
```

Note that the username must match exactly here, including any cleanup that may be happening (see `cleanup_username` above).  Also note that xyOps logs a warning in the activity log each time this is applied to a user.  This serves as a reminder to remove `admin_bootstrap` once everything is configured and working with your IdP groups (or manually assigned roles / privileges).

## Logging Out

When a user clicks the "Logout" button in the top-right corner of the xyOps UI, we need to perform some additional steps behind the scenes to *fully* log the user out.  With SSO in the mix, there are actually three cookies that need to be cleared:

- The xyOps session cookie.
- The OAuth2-Proxy cookie.
- The external IdP cookie.

xyOps handles the first one using its own API.  But you'll need to configure a custom `logout_url` in your `sso.json` file to redirect the user to afterwards.  With OAuth2-Proxy this should be set to:

```json
"logout_url": "/oauth2/sign_out?rd=_ENCODED_IDP_LOGOUT_URL_"
```

The `/oauth2/sign_out` is intercepted by OAuth2-Proxy and handles clearing the second cookie, and then finally that redirects to your IdP logout endpoint to close out the process.  The `_ENCODED_IDP_LOGOUT_URL` needs to be set by you, as it is customized per IdP and often specific to your organization (for e.g. your own branded logout page).  Also note that it needs to be properly URL-encoded.  Consult your identity provider documentation to see how to format this URL.

Here is the logout URL to use for GitHub, as an example:

```json
"logout_url": "/oauth2/sign_out?rd=https%3A%2F%2Fgithub.com%2Flogout"
```

**Advanced:** If your IdP passes along an ID Token via `Authorization: Bearer ...` header, and their logout URL accepts an [id_token_hint](https://openid.net/specs/openid-connect-rpinitiated-1_0.html#RPLogout) query parameter, you can include it in your encoded redirect URL by using this special placeholder macro: `[id_token_hint]`.  The expanded token itself will also be URL-encoded.  Example:

```json
"logout_url": "/oauth2/sign_out?rd=https%3A%2F%2F_YOUR_IDP_DOMAIN_%2Flogout%3Fid_token_hint%3D[id_token_hint]"
```

One final important note here.  When using OAuth2-Proxy, you will need to "whitelist" the IdP domain you will be redirecting to for logout.  Use the [whitelist_domains](https://oauth2-proxy.github.io/oauth2-proxy/configuration/overview/) configuration property for this (or the `OAUTH2_PROXY_WHITELIST_DOMAINS` environment variable).  Add the IdP domain *in addition to* your own xyOps domain, comma-separated:

```
OAUTH2_PROXY_WHITELIST_DOMAINS: ".yourcompany.com,.github.com"
```

# OAuth2-Proxy with TLS

Now you should be ready to integrate xyOps with OAuth2-Proxy.  You have several options for doing this.  If you have a single xyOps master server, then the best way is to run OAuth2-Proxy standalone.  That has the fewest moving parts, and OAuth2-Proxy can also terminate TLS for you.  This section covers that configuration.

Going from our docker compose shown above, we're going to swap xyOps in for the echo server, change the backend port number to `5522` (the xyOps default), tweak a few more settings for TLS, and add your certificate files.  Here is the updated docker compose file:

```yaml
services:
  oauth2-proxy:
    image: quay.io/oauth2-proxy/oauth2-proxy:latest
    ports: ["443:4180"] # port 443 on the outside
    environment:
	  OAUTH2_PROXY_TLS_CERT_FILE: "/etc/tls.crt" # your cert file
	  OAUTH2_PROXY_TLS_KEY_FILE: "/etc/tls.key" # your cert file
      OAUTH2_PROXY_PROVIDER: "oidc"
      OAUTH2_PROXY_OIDC_ISSUER_URL: "https://_YOUR_OIDC_ISSUER_URL_/"
      OAUTH2_PROXY_CLIENT_ID: "_YOUR_CLIENT_ID_"
      OAUTH2_PROXY_CLIENT_SECRET: "_YOUR_CLIENT_SECRET_"
      OAUTH2_PROXY_REDIRECT_URL: "http://localhost:4180/oauth2/callback"
      OAUTH2_PROXY_SCOPE: "openid profile email"
      OAUTH2_PROXY_COOKIE_SECRET: "_YOUR_COOKIE_SECRET_"
      OAUTH2_PROXY_EMAIL_DOMAINS: "_YOUR_EMAIL_DOMAINS_" 
      OAUTH2_PROXY_UPSTREAMS: "http://xyops1:5522" # xyops backend on port 5522
      OAUTH2_PROXY_HTTP_ADDRESS: "0.0.0.0:4180"
      OAUTH2_PROXY_COOKIE_SECURE: "true" # secure cookies now
      OAUTH2_PROXY_PASS_USER_HEADERS: "true"
      OAUTH2_PROXY_SET_AUTHORIZATION_HEADER: "true"
      OAUTH2_PROXY_PASS_ACCESS_TOKEN: "true"
      OAUTH2_PROXY_SKIP_PROVIDER_BUTTON: "true"
	  OAUTH2_PROXY_WHITELIST_DOMAINS: ".yourcompany.com" # add your domains
	  OAUTH2_PROXY_SKIP_AUTH_ROUTES: "^/(api|health|images|js|css|fonts|sounds|codemirror|manifest.webmanifest)(/|$)"
    volumes:
      - "./tls.crt:/etc/tls.crt:ro"
      - "./tls.key:/etc/tls.key:ro"

  xyops1:
    image: ghcr.io/pixlcore/xyops:latest
	environment:
	  XYOPS_hostname: "xyops.yourcompany.com"
      TZ: America/Los_Angeles
    volumes:
      - "./config.json:/opt/xyops/conf/config.json:ro"
	  - "./sso.json:/opt/xyops/conf/sso.json:ro"
```

A few things to note here:

- The external port has been changed to 443.
- We've set `OAUTH2_PROXY_COOKIE_SECURE` to `true`, as we'll be secure from this point onward.
- You'll need to point a domain at the proxy, and add it to `OAUTH2_PROXY_WHITELIST_DOMAINS` (as well as your IdP domain).
- Generate your TLS certificate files, and place them where Docker can find them (see `volumes:` above).

For the xyOps container, it needs two configuration files.  Grab our sample [config.json](https://github.com/pixlcore/xyops/blob/main/sample_conf/config.json) and [sso.json](https://github.com/pixlcore/xyops/blob/main/sample_conf/sso.json) files to use as starting points to create yours.  See the [xyOps Configuration Guide](config.md) for details on how to customize these files.

At the very least, make sure you set the [base_app_url](config.md#base_app_url) property to the domain that routes to the proxy (which sits in front), with a `https://` prefix.  You should also set the `XYOPS_hostname` to the same hostname (without the protocol prefix).  This is what xyOps uses to advertise itself to the server cluster, and generate URLs for new servers to connect.

In this case, since we are only running a single master server, we can route *everything* through the proxy, making things simpler.  You don't even need to expose any ports on the xyOps container.  Users hit the root `/` URI path and are authenticated via SSO, and API calls and server connections both hit the `/api` prefix, which is routed directly through to xyOps, and that uses its own authentication layer (API keys, tokens, etc.).

**Advanced**: For installations with a large amount of worker servers, it is better to expose the xyOps container under its own internal domain, and have worker servers connect directly to that, instead of going through OAuth2-Proxy.  Change the `XYOPS_hostname` environment variable to point to the dedicated xyOps domain to change how it advertises itself to the cluster.

## Multi-Master with OAuth2-Proxy and TLS with Nginx

For a load balanced multi-master setup with Nginx w/TLS and OAuth-Proxy for SSO, please read this section.  This is definitely the most complex setup, and requires advanced knowledge of all the components used.  Let me just plug our [Enterprise Plan](https://xyops.io/enterprise) one last time, as we can set all this up for you.  Now, the way this configuration works is as follows:

- [Nginx](https://nginx.org/) sits in front, and handles TLS termination, as well as routing requests to various backends.
- [OAuth2-Proxy](https://github.com/oauth2-proxy/oauth2-proxy) handles SSO, and is integrated via Nginx using the [auth_request](https://nginx.org/en/docs/http/ngx_http_auth_request_module.html) directive.
	- Meaning, OAuth2-Proxy sits "on the side" of the request flow, and is consulted for auth, then the request is routed from Nginx to xyOps.
	- When Nginx routes the authenticated request to xyOps, it forwards along the "trusted headers" for automatic user creation / user login.
- Nginx handles xyOps multi-master using an embedded [Health Check Daemon](https://github.com/pixlcore/xyops-healthcheck) which runs in the same container.
	- The health check keeps track of which server is master, and dynamically reconfigures and hot-reloads Nginx as needed.
	- We maintain our own custom Nginx docker image for this (shown below), or you can [build your own from source](https://github.com/pixlcore/xyops-nginx-sso/blob/main/Dockerfile).

A few prerequisites for this setup:

- For multi-master setups, **you must have an external storage backend**, such as NFS, S3, or S3-compatible (MinIO, etc.).
- You will need a custom domain configured and TLS certs created and ready to attach.
- You have your xyOps configuration files customized and ready to go ([config.json](https://github.com/pixlcore/xyops/blob/main/sample_conf/config.json) and [sso.json](https://github.com/pixlcore/xyops/blob/main/sample_conf/sso.json)) (see below).
- And of course you should have a pretested SSO configuration for OAuth2-Proxy, so you are confident that piece works before integrating it here.

For the examples below, we'll be using the following domain placeholders:

- `xyops.yourcompany.com` - User-facing domain which should route to Nginx / SSO.
- `xyops01.yourcompany.com` - Internal domain for master server #1.
- `xyops02.yourcompany.com` - Internal domain for master server #2.

The reason why the master servers each need their own unique (internal) domain name is because of how the multi-master system works.  Each master server needs to be individually addressable, and reachable by all of your worker servers in your org.  Worker servers don't know or care about Nginx -- they contact masters directly, and have their own auto-failover system.  Also, worker servers use a persistent WebSocket connection, and can send a large amount of traffic, depending on how many worker servers you have and how many jobs you run.  For these reasons, it's better to have worker servers connect the masters directly, especially at production scale.

That being said, you *can* configure your worker servers to connect through the Nginx front door if you want.  This can be useful if you have worker servers in another network or out in the wild, but it is not recommended for most setups.  To do this, please see [Overriding The Connect URL](hosting.md#overriding-the-connect-url) in our self-hosting guide.

Here is a docker compose file for running Nginx and OAuth2-Proxy in the proper configuration for multi-master with TLS and SSO.  xyOps is not included yet, as that will be running separately.

```yaml
services:
  nginx:
    image: ghcr.io/pixlcore/xyops-nginx-sso:latest
    depends_on:
      - oauth2-proxy
    init: true
    environment:
      XYOPS_masters: xyops01.yourcompany.com,xyops02.yourcompany.com
      XYOPS_port: 5522
    volumes:
      - "./tls.crt:/etc/tls.crt:ro"
      - "./tls.key:/etc/tls.key:ro"
    ports:
      - "443:443"

  oauth2-proxy:
    image: quay.io/oauth2-proxy/oauth2-proxy:latest
    environment:
      OAUTH2_PROXY_PROVIDER: "oidc"
      OAUTH2_PROXY_OIDC_ISSUER_URL: "https://_YOUR_OIDC_ISSUER_URL_/"
      OAUTH2_PROXY_CLIENT_ID: "_YOUR_CLIENT_ID_"
      OAUTH2_PROXY_CLIENT_SECRET: "_YOUR_CLIENT_SECRET_"
      OAUTH2_PROXY_REDIRECT_URL: "https://xyops.yourcompany.com/oauth2/callback"
      OAUTH2_PROXY_SCOPE: "openid profile email"
      OAUTH2_PROXY_COOKIE_SECRET: "_YOUR_COOKIE_SECRET_"
      OAUTH2_PROXY_EMAIL_DOMAINS: "_YOUR_EMAIL_DOMAINS_" 
      OAUTH2_PROXY_UPSTREAMS: "static://200" # no-op
      OAUTH2_PROXY_HTTP_ADDRESS: "0.0.0.0:4180"
      OAUTH2_PROXY_REVERSE_PROXY: "true"
      OAUTH2_PROXY_COOKIE_SECURE: "true" # secure cookies now
      OAUTH2_PROXY_PASS_USER_HEADERS: "true"
      OAUTH2_PROXY_SET_AUTHORIZATION_HEADER: "true"
      OAUTH2_PROXY_SET_XAUTHREQUEST: "true"
      OAUTH2_PROXY_PASS_ACCESS_TOKEN: "true"
      OAUTH2_PROXY_SKIP_PROVIDER_BUTTON: "true"
	  OAUTH2_PROXY_WHITELIST_DOMAINS: ".yourcompany.com" # add your domains
```

Let's talk about the Nginx setup first.  We are pulling in our own Docker image here ([xyops-nginx-sso](https://github.com/pixlcore/xyops-nginx-sso)).  This is a wrapper around the official Nginx docker image, but it includes our [xyOps Health Check](https://github.com/pixlcore/xyops-healthcheck) daemon.  The health check monitors which master server is currently primary, and dynamically reconfigures Nginx on-the-fly as needed (so Nginx always routes to the current primary server only).  The image also comes with a fully preconfigured Nginx, which will call to OAuth2-Proxy via the [auth_request](http://nginx.org/en/docs/http/ngx_http_auth_request_module.html) mechanism.  To use this image you will need to provide:

- Your TLS certificate files, named `tls.crt` and `tls.key`, which are bound to `/etc/tls.crt` and `/etc/tls.key`, respectively.
- The list of xyOps master server domain names, as a CSV list in the `XYOPS_masters` environment variable (used by health check).

Next is the OAuth2-Proxy setup (we use the official Docker image here).  Configuration is largely discussed above, but there are a few key things to point out this time:

- `OAUTH2_PROXY_UPSTREAMS` is set to a static response (`static://200`).  This is because with [auth_request](http://nginx.org/en/docs/http/ngx_http_auth_request_module.html) mode OAuth2-Proxy doesn't talk directly to the backend.  Instead, Nginx makes "side requests" to it for auth, and then Nginx itself routes authenticated requests to the real backend.
- `OAUTH2_PROXY_REVERSE_PROXY` is set to `true`.  This is required for running OAuth2-Proxy in auth_request mode.
- `OAUTH2_PROXY_SET_XAUTHREQUEST` is set to `true`.  This returns the set of trusted headers in auth_request mode.
- `OAUTH2_PROXY_SKIP_AUTH_ROUTES` has been removed, as OAuth2-Proxy doesn't actually do any routing in this configuration.

Once you have those two components running, we can fire up the xyOps backend.  This is listed separately as you'll usually want to run these on dedicated servers.  Here is the multi-master configuration as a single Docker compose file.  For additional master servers you can simply duplicate this and change the hostname:

```yaml
services:
  xyops1:
    image: ghcr.io/pixlcore/xyops:latest
    hostname: xyops01.yourcompany.com # change this per master server
    init: true
    environment:
      XYOPS_masters: xyops01.yourcompany.com,xyops02.yourcompany.com
      TZ: America/Los_Angeles
    volumes:
      - "./config.json:/opt/xyops/conf/config.json:ro"
	  - "./sso.json:/opt/xyops/conf/sso.json:ro"
	ports:
	  - "5522:5522"
	  - "5523:5523"
```

A few things to note here:

- We're using our official xyOps Docker image, but you can always [build your own from source](https://github.com/pixlcore/xyops/blob/main/Dockerfile).
- All master server hostnames need to be listed in the `XYOPS_masters` environment variable, comma-separated.
- All master servers need to be able to route to each other via their hostnames, so they can self-negotiate and hold elections.
- The timezone (`TZ`) should be set to your company's main timezone, so things like midnight log rotation and daily stat resets work as expected.
- You will need to supply two configuration files, `config.json` and `sso.json`.  See below.

Grab our sample [config.json](https://github.com/pixlcore/xyops/blob/main/sample_conf/config.json) and [sso.json](https://github.com/pixlcore/xyops/blob/main/sample_conf/sso.json) files to use as starting points to create yours.  See the [xyOps Configuration Guide](config.md) for details on how to customize these files.  Specifically though, let's talk about `sso.conf` for this configuration.  This file is largely discussed above (see [Configuration](#configuration) above), but the [Header Map](#header-map) in particular is going to be different for Nginx + OAuth2-Proxy: 

```json
"header_map": {
	"username": "x-auth-request-user",
	"full_name": "x-auth-request-user",
	"email": "x-auth-request-email",
	"groups": "x-auth-request-groups"
}
```

Notice the request header names are different; they all have a `x-auth-request-` prefix.  This is how Nginx forwards along trusted headers with it uses OAuth2-Proxy as a side effect via the [auth_request](http://nginx.org/en/docs/http/ngx_http_auth_request_module.html) mechanism.  So you will have to use this style of header in your `header_map` to properly map the user fields.

**Advanced:** xyOps actually performs its own TLS termination in its embedded web server, and hosts HTTPS on port 5523.  This is used by worker servers who connect to the master directly.  By default xyOps is configured with a self-signed certificate, which our satellite software ([xySat](https://github.com/pixlcore/xysat)) is designed to support.  You can change all this, however, and include signed certificates for use on your master servers, and also configure the worker servers to reject self-signed certs.  For more information, see [Self-Hosting Guide - TLS](hosting.md#tls).

## Troubleshooting

For troubleshooting OAuth2-Proxy, set these environment variables to enable additional debug logging:

```
OAUTH2_PROXY_STANDARD_LOGGING: "true"
OAUTH2_PROXY_AUTH_LOGGING: "true"
OAUTH2_PROXY_REQUEST_LOGGING: "true"
OAUTH2_PROXY_SHOW_DEBUG_ON_ERROR: "true"
```

For debugging issues on the xyOps side, set the [debug_level](config.md#debug_level) configuration property to `9`, and also enable the global [debug](config.md#debug) flag.  These options can also be set by environment variables:

```
XYOPS_debug_level: 9
XYOPS_debug: true
```

This will allow xyOps to log much more information about the SSO process, including all the incoming request headers.  xyOps actually logs to a dedicated SSO log which you can find here:

```
/opt/xyops/logs/SSO.log
```

# SAML

If you require [SAML](https://en.wikipedia.org/wiki/Security_Assertion_Markup_Language) for your SSO setup, we highly recommend [SSOReady](https://ssoready.com/), which can easily be integrated with [OAuth2-Proxy](https://github.com/oauth2-proxy/oauth2-proxy).  Basically, SSOReady provides a "SAML-to-OIDC bridge", which OAuth2-Proxy can talk directly with, just like any other OIDC identity provider.  SSOReady is free, [open source](https://github.com/ssoready/ssoready), and [can be self-hosted](https://ssoready.com/docs/self-hosting-ssoready) if you like, but their [hosted version](https://ssoready.com/pricing) is also extremely good.  This guide covers everything you need to get up and running with SAML.

## Prerequisites

- A [SSOReady](https://ssoready.com/) account (or self-host it) and an "Environment".
- An external SAML IdP (e.g., Okta, Entra ID, OneLogin) configured in SSOReady.
- Docker / Docker Compose running locally.

## SSOReady Setup

1. **Create an account / environment**
	- Register / login at `https://app.ssoready.com/`.
	- Create an environment (e.g., "Dev"). All keys you create live inside an environment.
2. **Create your Organization**
	- In the SSOReady portal, create an Organization.
	- Set or note its `organization_external_id` (e.g., `acme`).
	- You’ll pass this value on the authorization request so SSOReady knows *which* SAML connection to use.
3. **Create a "SAML OAuth Client"**
	- Go to "API Keys", then "Create SAML OAuth Client".
	- Copy these values:
		- **Client ID**: looks like `saml_oauth_client_...`
		- **Client Secret**: looks like `ssoready_oauth_client_secret_...`
		- These are your OAuth **client credentials** (not the org id).
4. **Add Redirect URL**
	- You can find this on the "Overview" tab.
	- Add `http://localhost:4180/oauth2/callback` for local testing.
	- You must add it to the **OAuth Redirect URI** field specifically, as we're using SAML-over-OAuth.
	- The redirect URL must match what you have set in OAuth2-Proxy **exactly** (scheme, host, port, path).

## OAuth2-Proxy Setup

[OAuth2-Proxy](https://github.com/oauth2-proxy/oauth2-proxy) needs to be configured specifically for SSOReady.  We cannot use OIDC discovery mode, because we need to set custom URLs for all the endpoints.  Luckily, OAuth2-Proxy allows us to customize everything, including skipping discovery and specifying all the OAuth URLs manually.  Here is a list of all the [OAuth2-Proxy Config Options](https://oauth2-proxy.github.io/oauth2-proxy/configuration/overview/#config-options) we need to set:

| Config Property | Type | Description |
|-----------------|------|-------------|
| `provider` | String | Which OIDC provider to use. Set this to `oidc` for generic, which is what we want. |
| `client_id` | String | Your SSOReady OAuth Client ID, which you get from the "SAML OAuth Client" page.  Looks like: `saml_oauth_client_********`. |
| `client_secret` | String | Your SSOReady OAuth Client Secret, which you get from the "SAML OAuth Client" page.  Looks like: `ssoready_oauth_client_secret_********`. |
| `skip_oidc_discovery` | Boolean | Skips the normal OIDC discovery process, as we are specifying all the individual URLs.  Set to `true`. |
| `login_url` | URL | Custom Login URL for SSOReady, with Organization ID in tow.  Set to: `https://auth.ssoready.com/v1/oauth/authorize?organization_external_id=_ORG_`.  See below for details. |
| `redeem_url` | URL | The token redemption endpoint.  Set to: `https://auth.ssoready.com/v1/oauth/token`.  This is custom for SSOReady. |
| `oidc_jwks_url` | URL | The OIDC JWKS URI for token verification.  Set to: `https://auth.ssoready.com/v1/oauth/jwks`.  This is required for SSOReady SAML. |
| `oidc_issuer_url` | URL | The OpenID Connect issuer URL.  For SSOReady this should be `https://auth.ssoready.com/v1/oauth`. |
| `redirect_url` | URL | The OAuth Redirect URL, which needs to match what we set in the SSOReady portal: `http://localhost:4180/oauth2/callback`. |
| `scope` | String | OAuth scope specification.  This list works for SSOReady: `openid profile email`. |
| `oidc_email_claim` | String | Which OIDC claim contains the user's email.  For most SAML IdPs this should be set to `sub`. |
| `email_domains` | String | Lock this down for live production, i.e. limit it to your email domain only, but for testing it can be set to `*`. |
| `pass_user_headers` | Boolean | Pass along the "trusted headers" that xyOps uses to log the user in.  Set to `true`. |
| `set_authorization_header` | Boolean | This sets the `Authorization Bearer` response header (useful in Nginx auth_request mode). Set to `true`. |
| `skip_provider_button` | Boolean | Skip the OAuth2-Proxy splash screen, and instead log the user in immediately.  Set to `true`. |
| `cookie_secret` | Base64 | Generate your own [base64-encoded cookie secret](https://oauth2-proxy.github.io/oauth2-proxy/configuration/overview/#generating-a-cookie-secret) for this. |
| `http_address` | IP:Port | Network and port for OAuth2-Proxy to listen on.  Set to: `0.0.0.0:4180`. |
| `upstreams` | URL | Where to pass the requests after authentication.  For testing, we'll use the [echo-server](https://hub.docker.com/r/ealen/echo-server) echoing web server, so set this to: `http://echo-server:80`. |

Note that all of these configuration properties can be specified as environment variables, by converting them to upper-case and adding a `OAUTH2_PROXY_` prefix, e.g. `OAUTH2_PROXY_PROVIDER`.  We'll be doing this below in our Docker Compose setup.

**Why we disable discovery**: OAuth2-Proxy doesn't let us add arbitrary login URL parameters, but we need to include `?organization_external_id=_YOUR_ORG_ID_` for SSOReady. So we are disabling discovery and setting endpoints explicitly, with our Org ID param passed in `login_url`.  Specifically, this is your SSOReady *external* Organization ID, which you get to type in when first creating the org.  Example: `acme`.

**Why we map the email claim:** OAuth2-Proxy needs an email to create a session. If your ID token’s email lives in `sub` (common with SAML providers), set `oidc_email_claim=sub` as shown.  However, this may differ for your SAML identity provider.  The default value of this setting in OAuth2-Proxy is `email`, so make sure to test that if `sub` doesn't work for you.

See the [Setup](#setup) section above to run a local test of OAuth2-Proxy using the [echo-server](https://hub.docker.com/r/ealen/echo-server) echoing web server, to test everything before you integrate xyOps.

Once everything is working, see the [Configuration](#configuration) section above to configure xyOps for SSO.

# Active Directory

If your company does not have an OIDC or SAML provider, but does have an [LDAP](https://en.wikipedia.org/wiki/Lightweight_Directory_Access_Protocol) or [Active Directory](https://en.wikipedia.org/wiki/Active_Directory) server, you can use [Authelia](https://www.authelia.com/) instead of OAuth2-Proxy.  Authelia works in the same way as OAuth2-Proxy, but supports LDAP or AD as an upstream user authentication provider.  It is also free and open source, and can forward trusted headers to xyOps.  See the following guides for assistance in setting this up:

- [Authelia LDAP Setup](https://www.authelia.com/configuration/first-factor/ldap/)
- [Authelia Active Directory Setup](https://www.authelia.com/integration/ldap/activedirectory/)
- [Authelia SSO Trusted Headers](https://www.authelia.com/integration/trusted-header-sso/introduction/)

The xyOps [Header Map](#header-map) should be set as follows:

```json
"header_map": {
	"username": "remote-user",
	"full_name": "remote-name",
	"email": "remote-email",
	"groups": "remote-groups"
}
```

Authelia can also be [integrated with Nginx](https://www.authelia.com/integration/proxies/nginx/) for TLS termination.

# Tailscale

xyOps works with [Tailscale](https://tailscale.com/) (specifically [Tailscale Serve](https://tailscale.com/kb/1312/serve)), which acts as an SSO auth system by forwarding trusted headers.  Here is how you should configure your [Header Map](#header-map) for Tailscale Serve use:

```json
"header_map": {
	"username": "Tailscale-User-Login",
	"full_name": "Tailscale-User-Name",
	"email": "Tailscale-User-Login",
	"avatar": "Tailscale-User-Profile-Pic",
	"groups": ""
}
```

Tailscale doesn't forward along user groups, so we cannot auto-assign user roles or privileges.  However, you can use the [Admin Bootstrap](#admin-bootstrap) feature to make yourself a full administrator, and then manually promote your other users once they login and have local xyOps user accounts.  Also, please read the [Header Cleanup](#header-cleanup) section regarding username cleanup, so you can be sure how your Tailscale username (which comes in an an email address) will be translated on the xyOps side.

Finally, make sure you set your [IP Whitelist](#ip-whitelist) to only accept headers from localhost, as that is how Tailscale Serve routes traffic:

```json
"whitelist": ["127.0.0.1", "::1/128"]
```

# Live Production

In a production environment, it is crucial to ensure the security and reliability of the SSO implementation. Here is a checklist:

1. **Use HTTPS Everywhere**: Always use HTTPS to encrypt the communication between the client and the server, as well as between the server and the identity provider.
2. **Monitor and Audit**: Continuously monitor and audit the SSO implementation for any suspicious activity or potential security breaches.
3. **Keep Software Updated**: Regularly update xyOps, including authentication libraries and frameworks, to ensure that any security vulnerabilities are patched.
4. **Whitelist Trusted IPs**: Use an IP whitelist to restrict where the trusted headers can come from (see below).
5. **Secure-Only Cookies**: Remember to set `OAUTH2_PROXY_COOKIE_SECURE` to `true` for live production.
6. **Restrict Email Domains**: Set `OAUTH2_PROXY_EMAIL_DOMAINS` to restrict your login email domain list.
7. **xyOps Base App URL**: Remember to set the [base_app_url](config.md#base_app_url) configuration property for your live production setup.
8. **Use Multiple Availability Zones**: For running multiple xyOps master servers, ideally put them in separate AZs.

## IP Whitelist

It's important to configure xyOps so that it **only** accepts trusted headers from your auth proxy server, and *nowhere else*.  To do this, add an IP `whitelist` property in your xyOps SSO configuration.  This should be an array of IPv4 and/or IPv6 addresses or ranges, including single IPs, partial IPs, and/or [CIDR blocks](https://en.wikipedia.org/wiki/Classless_Inter-Domain_Routing).

Our sample [sso.json](https://github.com/pixlcore/xyops/sample_conf/sso.json) file comes with a default whitelist consisting of all the [IPv4](https://en.wikipedia.org/wiki/Private_network#Private_IPv4_addresses) and [IPv6](https://en.wikipedia.org/wiki/Private_network#Private_IPv6_addresses) private address ranges, including the [localhost loopback](https://en.wikipedia.org/wiki/Localhost#Loopback) addresses (both IPv4 and IPv6 versions), and [link-local addresses](https://en.wikipedia.org/wiki/Link-local_address) (both IPv4 and IPv6 versions).  It uses the following set of [CIDR blocks](https://en.wikipedia.org/wiki/Classless_Inter-Domain_Routing):

```json
"whitelist": ["127.0.0.1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "::1/128", "fd00::/8", "169.254.0.0/16", "fe80::/10"]
```

This should work for most cases, but you can lock it down even further, to **only** accept trusted headers from your specific auth proxy server.  For example, if you are running xyOps and the auth proxy on the same server, you can lock it all the way down to only accept trusted headers from localhost:

```json
"whitelist": ["127.0.0.1", "::1/128"]
```
