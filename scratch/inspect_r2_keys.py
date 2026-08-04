import boto3
from botocore.config import Config

R2_ENDPOINT = "https://24871d1733baa733b470db9978234d96.r2.cloudflarestorage.com"
R2_ACCESS_KEY = "77916e5274c99b5a80aeca3f36a60071"
R2_SECRET_KEY = "9a815661086b43314b336cbf096ab07006ba585a831bb04e3509ca9aeb9ea580"

s3 = boto3.client(
    "s3",
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY,
    region_name="auto",
    config=Config(signature_version="s3v4")
)

paginator = s3.get_paginator("list_objects_v2")
all_objs = []
for page in paginator.paginate(Bucket="zyrexediting"):
    all_objs.extend(page.get("Contents", []))

user_objs = [o for o in all_objs if not o["Key"].startswith(("audio/", "creators/", "thumbnails/"))]
print(f"Total user upload objects in staging bucket: {len(user_objs)}")
for o in user_objs[:50]:
    print(f"  {o['Key']} ({o['Size']} B)")
