import boto3, os
from botocore.config import Config

ENDPOINT = 'https://24871d1733baa733b470db9978234d96.r2.cloudflarestorage.com'
KEY = '77916e5274c99b5a80aeca3f36a60071'
SECRET = '9a815661086b43314b336cbf096ab07006ba585a831bb04e3509ca9aeb9ea580'
BUCKET = 'sftpgo'
SRC = r'C:\Users\reyli\Desktop\sftpgo'

s3 = boto3.client('s3', endpoint_url=ENDPOINT, aws_access_key_id=KEY,
    aws_secret_access_key=SECRET, region_name='auto',
    config=Config(signature_version='s3v4'))

uploaded = 0
for root, dirs, files in os.walk(SRC):
    for fname in files:
        local_path = os.path.join(root, fname)
        rel_path = os.path.relpath(local_path, SRC).replace('\\', '/')
        try:
            s3.upload_file(local_path, BUCKET, rel_path)
            uploaded += 1
            if uploaded % 5 == 0:
                print(f'  [{uploaded}] {rel_path}')
        except Exception as e:
            print(f'  FAIL {rel_path}: {e}')

print(f'Done! Uploaded {uploaded} files to s3://{BUCKET}/')
