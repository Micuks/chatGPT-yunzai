import OpenAIAuth
email_address = input("Input your OpenAI email address")
password = input("Input your OpenAI password")
proxy = "" # (Optional) your proxy url
auth = OpenAIAuth.Authenticator(email_address=email_address,
                                password=password,
                                proxy=proxy)

auth.begin()
print(auth.get_access_token())
