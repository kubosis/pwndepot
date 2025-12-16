FROM node:22-slim

WORKDIR /project

COPY app/frontend/package.json app/frontend/package-lock.json* /project/app/frontend/

WORKDIR /project/app/frontend

RUN apt-get update --fix-missing
RUN npm install

COPY app/frontend /project/app/frontend

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]