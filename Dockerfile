FROM node:14.15.1-alpine

ARG UID=1001
ARG GID=1001

RUN apk --no-cache --virtual build-dependencies add \
    python \
    make \
    g++

RUN addgroup -S snjs -g $GID && adduser -D -S snjs -G snjs -u $UID

WORKDIR /var/www

RUN chown -R $UID:$GID .

USER snjs

COPY --chown=$UID:$GID package.json yarn.lock /var/www/

COPY --chown=$UID:$GID packages/config/package.json /var/www/packages/config/package.json
COPY --chown=$UID:$GID packages/domain-events/package.json /var/www/packages/domain-events/package.json
COPY --chown=$UID:$GID packages/snjs/package.json /var/www/packages/snjs/package.json

RUN yarn install --pure-lockfile

COPY --chown=$UID:$GID . /var/www

RUN yarn build

EXPOSE 9001

ENTRYPOINT [ "docker/entrypoint.sh" ]

CMD [ "start-web" ]
