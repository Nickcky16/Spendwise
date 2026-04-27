# Security Specification for SpendWise

## Data Invariants
1. A User profile can only be created/read/updated by the owner (UID match).
2. An Expense must belong to a valid user (userId must match request.auth.uid).
3. A Budget must belong to a valid user (userId must match request.auth.uid).
4. Users cannot modify their budget or profile in ways that compromise other users' data.
5. Expenses and Budgets are private to the owner.

## The "Dirty Dozen" Payloads

1. **Spoofed User Registration**: Create a profile with someone else's UID.
2. **Ghost Profile Update**: Add unauthorized fields like `isAdmin: true` to user profile.
3. **Cross-User Expense Read**: Attempt to fetch expenses where `userId != auth.uid`.
4. **Shadow Expense Write**: Create an expense for another user.
5. **Budget Limit Injection**: Set a negative budget limit.
6. **Expense ID Poisoning**: Use a 2KB string as an expense document ID.
7. **Budget Category Poisioning**: Use a extremely long string for category name.
8. **Unauthorized Profile Field Update**: Change `email` in profile (should be immutable or strictly validated).
9. **Bulk Expense Scraping**: List all expenses without a filter.
10. **Terminal State Bypass**: (N/A for this app currently, but good to keep in mind).
11. **Resource Exhaustion**: Send a massive string in `description`.
12. **Timestamp Spoofing**: Provide a future `createdAt` date from the client.

## Test Runner (Draft Logic)
- `users`: `allow read, write: if request.auth.uid == userId`
- `expenses`: `allow read, list: if resource.data.userId == request.auth.uid`, `allow create: if request.resource.data.userId == request.auth.uid`
- `budgets`: `allow read, list: if resource.data.userId == request.auth.uid`
