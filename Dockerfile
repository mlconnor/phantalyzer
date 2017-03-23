FROM node:boron

# Create app directory
RUN mkdir -p /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app/
RUN npm install

# Bundle app source
COPY . /usr/src/app

EXPOSE 3000

WORKDIR /usr/src/app

CMD [ "npm", "start" ]
