###########
# BUILDER #
###########

# pull official base image
#FROM python:3.11.4-slim-bullseye as builder

# set work directory
#WORKDIR /usr/src/app

# set environment variables
#ENV PYTHONDONTWRITEBYTECODE 1
#ENV PYTHONUNBUFFERED 1

# install system dependencies
#RUN apt-get update && \
#    apt-get install -y --no-install-recommends gcc

# lint
#RUN pip install --upgrade pip
#RUN pip install flake8==6.0.0
#COPY . /usr/src/app/
# RUN flake8 --ignore=E501,F401 .

# install python dependencies
#COPY ./requirements.txt .
#RUN pip wheel --no-cache-dir --no-deps --wheel-dir /usr/src/app/wheels -r requirements.txt



#########
# FINAL #
#########



# Use an official Python runtime as a parent image
FROM python:3.11.4-slim-bullseye

# create directory for the app user
RUN mkdir -p /home/app

# create the app user
RUN addgroup --system app && adduser --system --group app

# create the appropriate directories
ENV HOME=/home/app
ENV APP_HOME=/home/app/web
RUN mkdir $APP_HOME
RUN mkdir /home/app/Data
RUN mkdir /home/app/web/Logs
WORKDIR $APP_HOME

# Install PostgreSQL client utilities
RUN apt-get update && apt-get install -y postgresql-client

# install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends netcat sshpass &&  apt-get install -y --no-install-recommends zip
#COPY --from=builder /usr/src/app/wheels /wheels
COPY . /requirements.txt .
# Install Python dependencies
RUN pip install -r requirements.txt
#RUN pip install --upgrade pip
#RUN pip install --no-cache /wheels/*

# copy entrypoint.prod.sh
# COPY ./entrypoint.sh .
# RUN sed -i 's/\r$//g'  $APP_HOME/entrypoint.sh
# RUN chmod +x  $APP_HOME/entrypoint.sh

# copy project
COPY . $APP_HOME

# chown all the files to the app user
RUN chown -R app:app $APP_HOME

RUN find $APP_HOME -type d -exec chmod 755 {} +
RUN find $APP_HOME -type f -exec chmod 644 {} +

# change to the app user
USER app

EXPOSE 8000

# run entrypoint.prod.sh
#ENTRYPOINT ["/home/app/web/entrypoint.sh"]
CMD ["sh", "-c", "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]

# # set work directory
# WORKDIR /usr/src/app

# # Set environment variables
# ENV PYTHONDONTWRITEBYTECODE 1
# ENV PYTHONUNBUFFERED 1

# # Set the working directory in the container
# #WORKDIR /app

# RUN apu-get update && apt-get install -y netcat

# # Install PostgreSQL client utilities
# RUN pip install --upgrade pip

# # Copy the requirements file into the container
# COPY requirements.txt ./

# # Install Python dependencies
# RUN pip install -r requirements.txt

# COPY ./entrypoint.sh .
# RUN sed -i 's/\r$//g' /usr/src/app/entrypoint.sh
# RUN chmod +x /usr/src/app/entrypoint.sh

# # Copy the rest of the application code into the container
# COPY . .

# # Expose the port the app runs on
# EXPOSE 9000

# # Run the application and include migration
# CMD ["sh", "-c", "python manage.py migrate && gunicorn --bind 0.0.0.0:9000 server.wsgi:application"]

# ENTRYPOINT ["/usr/src/app/entrypoint.sh"]
