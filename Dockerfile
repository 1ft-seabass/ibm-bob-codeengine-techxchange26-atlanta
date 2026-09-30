FROM icr.io/codeengine/node:22-alpine
COPY package.json .
RUN npm install --omit=dev
RUN mkdir public
COPY public/ public/
COPY server.js .
EXPOSE 8080
CMD [ "node", "server.js" ]
