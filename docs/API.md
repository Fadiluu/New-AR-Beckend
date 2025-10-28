## API Documentation

Base URL
- Local: `http://localhost:4000`
- All endpoints are prefixed with `/api/...`
- Auth: Bearer JWT in `Authorization` header unless marked Public

Auth & Headers
- Header: `Authorization: Bearer <JWT>`
- Content-Type: `application/json` for body requests

### Authentication

Register
- Method/Path: POST `/api/auth/register`
- Body:
  - `firstName` string, `lastName` string, `email` string, `username` string, `password` string
- 201 Response:
  - `data.token`: JWT
  - `data.user`: user profile, points

Login
- Method/Path: POST `/api/auth/login`
- Body: `username`, `password`
- 200 Response: `data.token`, `data.user`

Logout
- Method/Path: POST `/api/auth/logout`
- Header: Authorization required
- 200 Response: token blacklisted (in-memory). Login again to get a new token.

Notes
- Token expiration: `7d` by default
- In-memory blacklist: invalidates tokens on this instance only (use Redis for multi-instance)

### Users

Get my profile
- Method/Path: GET `/api/users/profile`
- Auth: Required
- 200: full user document except password

Update my profile
- Method/Path: PUT `/api/users/profile`
- Auth: Required
- Body (any subset): `firstName`, `lastName`, `email`, `pictureUrl`
  - `email` validated and must be unique
  - `pictureUrl` must be a valid URL with protocol
- 200: updated user

Get my points
- Method/Path: GET `/api/users/points`
- Auth: Required
- 200: `{ points: number }`

Leaderboard (top 5 by points)
- Method/Path: GET `/api/users/leaderboard`
- Auth: Public
- 200: array of users with `profile.firstName`, `profile.lastName`, `login.username`, `rewardPoints.total`

Check admin
- Method/Path: GET `/api/users/is-admin`
- Auth: Required
- 200: `{ isAdmin: boolean }`

Get user rewards & history (by user id)
- Method/Path: GET `/api/users/:id/rewards`
- Auth: Required (self or admin)
- Query: `page`, `limit`
- 200: `user` summary, `statistics` (totals, first/last reward), `rewards.history` (paginated from `RewardHistory`)

Admin utility (dev-only)
- Make user admin
  - Method/Path: POST `/api/users/make-admin/:id`
  - Auth: Currently not required (dev-only); protect in production
  - 200: user with role updated to `admin`

### Places

Get all places (paginated)
- Method/Path: GET `/api/places/all`
- Auth: Public
- Query: `page` (default 1), `limit` (default 50)
- 200: `data` places, `pagination` metadata

Nearby places by coordinates
- Method/Path: GET `/api/places`
- Auth: Public
- Query:
  - `lat` number, `lng` number, `radius` meters (default 1000)
- If `lat/lng` provided: returns nearest places using `$nearSphere`
- If not provided: returns up to 100 places

Place details
- Method/Path: GET `/api/places/:id`
- Auth: Public
- 200: place document

Bookmark a place
- Method/Path: POST `/api/places/:id/bookmark`
- Auth: Required
- 200: updated bookmarks id array

List my bookmarks
- Method/Path: GET `/api/places/bookmarks/me`
- Auth: Required
- 200: populated list of places

Remove bookmark
- Method/Path: DELETE `/api/places/:id/bookmark`
- Auth: Required
- 200: updated bookmarks id array

Award points at eligible place (visit redemption)
- Method/Path: POST `/api/places/:id/redeem`
- Auth: Required
- Logic:
  - Checks `place.redemption.eligible === true`
  - Awards `place.redemption.pointsCost` to user (adds to total)
  - Creates positive `RewardHistory` entry
- 200:
  - `pointsAwarded`, `totalPoints`

Create place (admin)
- Method/Path: POST `/api/places`
- Auth: Admin
- Body:
  - `name` string, `description` string
  - `location`: `{ type: 'Point', coordinates: [lng, lat] }`
  - `redemption` optional: `{ eligible: boolean, pointsCost: number }`
  - `images` optional: `[{ url, caption? }]`
- 201: created place

Place schema notes
- `redemption.eligible` default false
- `redemption.pointsCost` default 0
- `location` uses GeoJSON `[lng, lat]`

### Rewards (Catalog)

List available rewards (active)
- Method/Path: GET `/api/rewards`
- Auth: Public
- Query: `page`, `limit`, `type` (voucher|discount|coupon|gift|experience|other)
- 200: list with pagination

Get reward details
- Method/Path: GET `/api/rewards/:id`
- Auth: Public
- 200: reward document (must be active)

Redeem a reward (deducts points)
- Method/Path: POST `/api/rewards/:id/redeem`
- Auth: Required
- Logic:
  - Checks reward exists, `isActive`, and not expired (`validUntil`)
  - Checks user has enough `rewardPoints.total >= pointsCost`
  - Deducts points and logs a negative `RewardHistory` event
- 200: `reward` summary, `user.remainingPoints`

Create reward (admin)
- Method/Path: POST `/api/rewards`
- Auth: Admin
- Body (required): `name`, `shortDescription`, `description`, `pointsCost` (>=1), `type` (enum)
- Optional: `termsAndConditions` (array), `images`, `isActive`, `validUntil` ISO date, `terms`
- 201: created reward

Update reward (admin)
- Method/Path: PUT `/api/rewards/:id`
- Auth: Admin
- Body: any of `name`, `shortDescription`, `description`, `termsAndConditions`, `pointsCost`, `type`, `images`, `isActive`, `validUntil`, `terms`
- 200: updated reward

Delete reward (admin)
- Method/Path: DELETE `/api/rewards/:id`
- Auth: Admin
- 200: success

Admin: list all rewards (including inactive)
- Method/Path: GET `/api/rewards/admin/all`
- Auth: Admin
- Query: `page`, `limit`
- 200: list with pagination

Reward schema highlights
- `name`, `shortDescription`, `description`, `termsAndConditions` (array), `pointsCost` (>=1), `type` enum
- `images`: `[{ url, caption? }]`
- `isActive` boolean, `validUntil` date, `terms` string

### Check-ins (optional)

Create check-in (awards fixed 10 points if within distance constraints)
- Method/Path: POST `/api/checkins`
- Auth: Required
- Body: `{ placeId, coordinates: [lng, lat] }`
- 201: `points.awarded` and updated `points.total`

Get my check-ins
- Method/Path: GET `/api/checkins`
- Auth: Required
- 200: latest 50 with place populated

Note: The current flow does not require check-ins to award visit points. They can be ignored if not needed.

### Health

- Method/Path: GET `/health`
- Auth: Public
- 200: `{ status: 'ok' }`

### Status Codes

- 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 500 Server Error

### Common Patterns

- Authorization header: `Authorization: Bearer <JWT>`
- Pagination response: `pagination: { currentPage, totalPages, totalItems, itemsPerPage, hasNext, hasPrev }`
- Validation errors return `{ success: false, message }`
- Reward history logs every points change (positive from visits, negative from redeeming catalog rewards)

### Quick cURL Examples

Login
```
curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"demo\",\"password\":\"secret\"}"
```

Get rewards
```
curl http://localhost:4000/api/rewards
```

Redeem reward
```
curl -X POST http://localhost:4000/api/rewards/REWARD_ID/redeem -H "Authorization: Bearer TOKEN"
```

Award visit points at place
```
curl -X POST http://localhost:4000/api/places/PLACE_ID/redeem -H "Authorization: Bearer TOKEN"
```


