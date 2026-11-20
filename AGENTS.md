# Architecture rules

- Read tenant billing state through the validated user's client and an explicit owner filter; reserve the administrative client for privileged writes so ordinary navigation does not require a service credential and remains protected by RLS.