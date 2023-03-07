import OpenAIAuth
from getpass import getpass


email_address = input("Input your OpenAI email address\n")
password = getpass("Input your OpenAI password\n")
proxy = "" # (Optional) your proxy url
auth = OpenAIAuth.Authenticator(email_address=email_address,
                                password=password,
                                proxy=proxy)

print("Fetching access token, please wait...")

auth.begin()
print(auth.get_access_token())
