from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import psycopg2
import os

default_args = {
    'owner': 'karim',
    'depends_on_past': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=1),
}


def expire_old_requests():
    conn = psycopg2.connect(
        dbname=os.getenv("POSTGRES_DB"),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),  # optional if not required
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=os.getenv("POSTGRES_PORT", 5432)
    )
    
    cur = conn.cursor()
    
    cur.execute("""
    UPDATE requests
    SET status = 'expired'
    WHERE time < CURRENT_TIMESTAMP AND status != 'expired';
""")
    
    conn.commit()
    cur.close()
    conn.close()
    print("Old requests expired.")

with DAG(
    'expire_old_requests',
    default_args=default_args,
    description='Expire stale requests daily',
    schedule_interval='@daily',
    start_date=datetime(2025, 6, 26),
    catchup=False,
    tags=['tipafriend'],
) as dag:

    expire_requests_task = PythonOperator(
        task_id='expire_requests_task',
        python_callable=expire_old_requests,
    )
