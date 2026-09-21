# Etapa 1: compila el juego. Las fotos (photos/) y el video (videos/) se empaquetan aquí,
# así que tienen que estar en la carpeta del proyecto al construir la imagen.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa 2: solo Nginx sirviendo los archivos estáticos.
FROM nginx:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
