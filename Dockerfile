FROM ubuntu:22.04

ENV HOME=/home/generic
WORKDIR $HOME

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends tzdata \
    && apt-get install -y nginx curl python python3 build-essential

RUN export NODEV='18.2.0' \
    && curl "https://nodejs.org/dist/v${NODEV}/node-v${NODEV}-linux-x64.tar.gz" | tar -xzv \
    && cp ./node-v${NODEV}-linux-x64/bin/node /usr/bin/ \
    && ./node-v${NODEV}-linux-x64/bin/npm install -g npm

COPY ./ $HOME
WORKDIR $HOME

RUN npm install

CMD npm run lint \
    && npm test
