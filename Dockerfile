# Use official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the current directory contents into the container at /app
COPY . .

# Make port 5000 available to the world outside this container
EXPOSE 5000

# Define environment variable
ENV NAME World
ENV FLASK_APP=run_dev.py
ENV FLASK_RUN_HOST=0.0.0.0

# Run app.py when the container launches
# Use CMD to run the application
CMD ["python", "run_dev.py"]