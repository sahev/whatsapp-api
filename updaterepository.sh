git reset --hard origin/main
git pull origin main

docker stop whatsapp-api
docker rm whatsapp-api
docker rmi whatsapp-api

docker build -t whatsapp-api:dev .

docker run -d -p 4040:4040 --name whatsapp-api --restart=always whatsapp-api