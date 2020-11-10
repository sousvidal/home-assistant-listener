FROM node:lts
WORKDIR /var/home-assistant-listener
COPY package.json ./
COPY yarn.lock ./
RUN yarn install --production
COPY . .
CMD yarn start
EXPOSE 8069