FROM node:20-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
COPY tasks/T02/package.json tasks/T02/package.json
COPY tasks/T08/package.json tasks/T08/package.json
COPY tasks/T03/backend/requirements.txt tasks/T03/backend/requirements.txt
RUN npm install --omit=dev --ignore-scripts
RUN python3 -m pip install --no-cache-dir --break-system-packages -r tasks/T03/backend/requirements.txt
COPY . .
ENV NODE_ENV=production
EXPOSE 4170
CMD ["npm", "run", "start"]
