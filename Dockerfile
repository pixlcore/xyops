FROM node:24-bookworm-slim

LABEL org.opencontainers.image.source="https://github.com/pixlcore/xyops"
LABEL org.opencontainers.image.description="A complete task scheduler and server monitoring system."
LABEL org.opencontainers.image.licenses="BSD-3-Clause"

ENV DEBIAN_FRONTEND=noninteractive

# Install system packages and the Docker CLI together so apt caches are
# removed before this layer is saved.
RUN set -eu; \
	apt-get update; \
	apt-get install -y --no-install-recommends \
	zip unzip xz-utils bzip2 procps lsof \
	iputils-ping \
	dnsutils \
	openssh-client \
	net-tools \
	curl \
	wget \
	vim \
	less \
	sudo \
	iproute2 \
	tzdata \
	build-essential \
	python3 \
	python3-distutils \
	python3-setuptools \
	pkg-config \
	libc6-dev \
	libssl-dev \
	zlib1g-dev \
	libffi-dev \
	git \
	ca-certificates \
	gnupg; \
	. /etc/os-release; \
	install -m 0755 -d /etc/apt/keyrings; \
	curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc; \
	chmod a+r /etc/apt/keyrings/docker.asc; \
	ARCH=$(dpkg --print-architecture); \
	echo "deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.asc] \
	https://download.docker.com/linux/$ID ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" \
	> /etc/apt/sources.list.d/docker.list; \
	apt-get update; \
	apt-get install -y --no-install-recommends docker-ce-cli; \
	apt-get clean; \
	rm -rf /var/lib/apt/lists/*

# Install and move uv in one layer to avoid retaining the original binaries.
RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
	&& mv /root/.local/bin/uv /usr/local/bin/uv \
	&& mv /root/.local/bin/uvx /usr/local/bin/uvx

WORKDIR /opt/xyops
COPY . .

ENV XYOPS_foreground=true
ENV XYOPS_color=true
ENV XYOPS_echo="xyOps Transaction Error error API Unbase Action Comm Job Workflow Maint Multi Extension Terminal Scheduler SSO User Ticket Alert"

# Install dependencies and clear the npm cache before this layer is saved.
# Fix useragent-ng permissions, build the assets, and create runtime directories.
# Remove generated config in this layer so each container initializes its own secret key.
RUN npm install \
	&& npm cache clean --force \
	&& chmod 644 node_modules/useragent-ng/lib/regexps.js \
	&& node bin/build.js dist \
	&& rm -rf /opt/xyops/conf \
	&& mkdir -p data logs temp

# Install xysat locally and clear its npm cache in the same layer.
RUN mkdir /opt/xyops/satellite; \
	cd /opt/xyops/satellite; \
	curl -L https://github.com/pixlcore/xysat/archive/main.tar.gz | tar zxvf - --strip-components 1; \
	npm install && npm cache clean --force

VOLUME /opt/xyops/data

EXPOSE 5522/tcp
EXPOSE 5523/tcp

CMD ["bash", "bin/container-start.sh"]
