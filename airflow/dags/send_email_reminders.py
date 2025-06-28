from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.utils.email import send_email_smtp
from datetime import datetime, timedelta
import psycopg2
import os

default_args = {
    'owner': 'karim',
    'depends_on_past': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=1),
    'email_on_failure': True,
    'email': ['karim.waleid@gmail.com'],  # fallback email
}

def send_reminders():
    conn = psycopg2.connect(
        dbname="tipafrienddb",
        user="karimkhalil",
        host="host.docker.internal",
        port=5432
    )
    cur = conn.cursor()

    cur.execute("""
        SELECT u.email, r.title, r.time
        FROM requests r
        JOIN users u ON r.user_id = u.id
        WHERE r.time BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '12 hours'
        AND r.status NOT IN ('expired', 'completed');
    """)
    reminders = cur.fetchall()

    for email, title, time in reminders:
        subject = f"⏰ Upcoming Task Reminder: {title}"
        body = f"Hi there!\n\nJust a reminder that your request \"{title}\" is scheduled at {time}.\nDon't forget!\n\n– Tip A Friend Team"
        send_email_smtp(to=email, subject=subject, html_content=body)

    cur.close()
    conn.close()

with DAG(
    'send_email_reminders',
    default_args=default_args,
    description='Email users about upcoming tasks',
    schedule_interval='@hourly',
    start_date=datetime(2025, 6, 28),
    catchup=False,
    tags=['tipafriend'],
) as dag:

    send_reminder_task = PythonOperator(
        task_id='send_reminder_emails',
        python_callable=send_reminders,
    )
