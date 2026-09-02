from django.contrib.auth import get_user_model

User = get_user_model()

# Replace with your desired superuser details
username = 'radar-admin'
email = 'radar@gmail.com'
password = 'csu-radar'

# Create superuser if it doesn't already exist
if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username=username, email=email, password=password)
    print('Superuser created successfully')
else:
    print('Superuser already exists')
