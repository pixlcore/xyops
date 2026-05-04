# xyOps™

![xyOps Screenshot](https://pixlcore.com/images/blog/xyops/workflow-edit.webp)

xyOps™ is a next-generation system for job scheduling, workflow automation, server monitoring, alerting, and incident response -- all combined into a single, cohesive platform. It's built for developers and operations teams who want to control their automation stack without surrendering data, freedom, or visibility. xyOps doesn't hide features behind paywalls or push telemetry back to anyone. It's open, extensible, and designed to run anywhere.

## The Idea Behind xyOps

Most automation platforms focus on workflow orchestration -- they run tasks, but they don't really help you see what's happening behind them. xyOps takes it further. It doesn't just schedule jobs; it connects them to real-time monitoring, alerts, server snapshots, and ticketing, creating a single, integrated feedback loop. When an alert fires, the email includes the running jobs on that server. One click opens a snapshot showing every process, CPU load, and network connection. If a job fails, xyOps can open a ticket with full context -- logs, history, and linked metrics. Everything in xyOps talks to everything else, so you can trace an issue from detection to resolution without ever leaving the system.

## Features at a Glance

- **Why xyOps?**
  - Schedule jobs across your fleet, track performance, set alerts, and view everything live, all in one place.
- **Job Scheduling Reimagined**
  - xyOps brings superpowers to job scheduling, way beyond cron.
- **Build Workflows Visually**
  - Use the graphical workflow editor to connect events, triggers, actions, and monitors into meaningful pipelines.
- **Monitor Everything**
  - Define exactly what you want to monitor, and get notified the moment things go wrong.
- **Smart Alerts**
  - Rich alerting with full customization and complex triggers.
- **Built for Fleets**
  - Whether you have five servers or five thousand, xyOps adapts to your needs.
- **Developer-Friendly**
  - Designed with you in mind. Yes, **you**!
- **Simple Setup**
  - From download to deployment in minutes.
- **Licensing**
  - xyOps is BSD-licensed for maximum flexibility.

# Installation

See our **[Self-Hosting Guide](https://docs.xyops.io/hosting)** for installation details.

## Pricing

### Free Tier

For individuals looking to self-host xyOps:

- All app features
- Community support
- Open source forever

If you use xyOps and love it, consider [becoming a sponsor](https://github.com/sponsors/pixlcore) here on GitHub.

### Professional Tier

For production installs, we highly recommend our **[Professional Plan](https://xyops.io/pricing)**, which includes:

- All app features
- Professional support
- Private ticketing system
- 24 hour turnaround on tickets

### Enterprise Tier

For larger enterprises, sign up for our **[Enterprise Plan](https://xyops.io/pricing)**, which includes:

- All app features
- Enterprise support
- SSO setup and support
- Air-gapped installation support
- Private ticketing system
- 1 hour turnaround on tickets
- Live chat with our team

# Documentation

Check out our official docs site here: **[xyOps Documentation](https://docs.xyops.io)**

Full documentation is also provided inside the xyOps app.  Just click the "Documentation" link in the sidebar.

# Videos

Visit our official YouTube channel for xyOps tutorials: [@PixlCore-Media](https://www.youtube.com/@PixlCore-Media)

Watch a quick overview of xyOps to see how the platform helps teams orchestrate workflows, monitor systems, and operate with confidence:

[![Watch the video](https://img.youtube.com/vi/NxZKylkKfOg/hqdefault.jpg)](https://www.youtube.com/watch?v=NxZKylkKfOg)

# Contributing

Please read our **[Contributing Guide](https://github.com/pixlcore/xyops/blob/main/CONTRIBUTING.md)** before opening a pull request.

TL;DR; we do not accept feature PRs, but there are **lots** of other ways you can contribute!  See the guide for details.

# Development

See our **[Development Guide](https://docs.xyops.io/dev)** for local dev setup.  In short, install [Node.js LTS](https://nodejs.org/en/download) and then:

```sh
git clone https://github.com/pixlcore/xyops.git
cd xyops
npm install
node bin/build.js dev
echo '{ "secret_key": "test" }' > conf/overrides.json
bin/debug.sh
```

# Security

Read our **[Security Guide](https://docs.xyops.io/security)** to learn how to report security vulnerabilities to the xyOps team.

Please do **not** submit vulnerabilities as GitHub issues!

# Governance

The xyOps project exists to empower users and developers through openness, reliability, and fairness.

Our **[Governance Model](https://docs.xyops.io/governance)** is designed to preserve these principles indefinitely.

# Longevity

Please read our open source **[Longevity Pledge](https://github.com/pixlcore/xyops/blob/main/LONGEVITY.md)**.  The TL;DR; is:

xyOps will always be open-licensed, and always OSI-approved. No rug pulls.

# License

xyOps™ is licensed under the **BSD-3-Clause** license.

See [LICENSE.md](https://github.com/pixlcore/xyops/blob/main/LICENSE.md) for full license text.
