/**
 * Sacred Connect — Comprehensive API Test Suite
 * Tests 10 scenario groups against the live server on port 5000
 * Usage: node scripts/comprehensiveTest.js
 */

const http = require('http');
const PORT = 5000;

// ─── shared state ─────────────────────────────────────────────────────────────
const state = {
  devoteeToken: null, devoteeId: null, devoteeName: null,
  devotee2Token: null, devotee2Id: null,
  priestToken: null, priestId: null, priestName: null,
  priestProfileId: null,
  bookingId: null,
  bookingId2: null,
  notificationId: null,
  addressId: null,
};

// ─── reporter ─────────────────────────────────────────────────────────────────
const results = [];
let currentSuite = '';

function suite(name) {
  currentSuite = name;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  SUITE: ${name}`);
  console.log('═'.repeat(60));
}

function record(name, passed, detail = '') {
  results.push({ suite: currentSuite, name, passed, detail });
  const icon = passed ? '  ✅' : '  ❌';
  console.log(`${icon}  ${name}${detail ? `\n       └─ ${detail}` : ''}`);
}

function pass(name, detail) { record(name, true, detail); }
function fail(name, detail) { record(name, false, detail); }

// ─── http helper ─────────────────────────────────────────────────────────────
function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost', port: PORT, path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = http.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

// Future booking date helpers
function futureDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

function pastDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

const BASE_BOOKING = () => ({
  priestId: state.priestProfileId,
  ceremonyType: 'Satyanarayan Puja',
  date: futureDate(5),
  startTime: '10:00',
  endTime: '12:00',
  location: { address: '1 Test Lane', city: 'Bangalore', state: 'Karnataka', pincode: '560001' },
  basePrice: 5000,
  platformFee: 250,
  totalAmount: 5250,
  paymentStatus: 'pending',
});

// ═══════════════════════════════════════════════════════════════════════
// SUITE 1 — Authentication
// ═══════════════════════════════════════════════════════════════════════
async function suiteAuth() {
  suite('1. Authentication');

  // 1a. Login with valid devotee credentials
  const r1 = await req('POST', '/api/auth/login', { identifier: 'devotee@example.com', password: 'password123' });
  if (r1.status === 200 && r1.body.token) {
    state.devoteeToken = r1.body.token;
    state.devoteeId = r1.body._id;
    state.devoteeName = r1.body.name;
    pass('Valid devotee login returns 200 + token', `user: ${r1.body.name}`);
  } else {
    fail('Valid devotee login', `HTTP ${r1.status} — ${JSON.stringify(r1.body)}`);
  }

  // 1b. Login with second devotee
  const r1b = await req('POST', '/api/auth/login', { identifier: 'devotee1@example.com', password: 'password123' });
  if (r1b.status === 200 && r1b.body.token) {
    state.devotee2Token = r1b.body.token;
    state.devotee2Id = r1b.body._id;
    pass('Second devotee login', `user: ${r1b.body.name}`);
  } else {
    fail('Second devotee login', `HTTP ${r1b.status}`);
  }

  // 1c. Valid priest login
  const r2 = await req('POST', '/api/auth/login', { identifier: 'priest1@example.com', password: 'password123' });
  if (r2.status === 200 && r2.body.token) {
    state.priestToken = r2.body.token;
    state.priestId = r2.body._id;
    state.priestName = r2.body.name;
    pass('Valid priest login returns 200 + token', `user: ${r2.body.name}`);
  } else {
    fail('Valid priest login', `HTTP ${r2.status} — ${JSON.stringify(r2.body)}`);
  }

  // 1d. Wrong password
  const r3 = await req('POST', '/api/auth/login', { identifier: 'devotee@example.com', password: 'wrongpassword' });
  if (r3.status === 401 || r3.status === 400) {
    pass(`Wrong password returns 4xx (got ${r3.status})`);
  } else {
    fail(`Wrong password should return 4xx`, `got HTTP ${r3.status}`);
  }

  // 1e. Non-existent user
  const r4 = await req('POST', '/api/auth/login', { identifier: 'nobody@nowhere.com', password: 'password123' });
  if (r4.status === 404 || r4.status === 401 || r4.status === 400) {
    pass(`Non-existent user returns 4xx (got ${r4.status})`);
  } else {
    fail(`Non-existent user should return 4xx`, `got HTTP ${r4.status}`);
  }

  // 1f. Missing identifier field
  const r5 = await req('POST', '/api/auth/login', { password: 'password123' });
  if (r5.status >= 400) {
    pass(`Missing identifier returns 4xx (got ${r5.status})`);
  } else {
    fail(`Missing identifier should fail`, `got HTTP ${r5.status}`);
  }

  // 1g. Empty body
  const r6 = await req('POST', '/api/auth/login', {});
  if (r6.status >= 400) {
    pass(`Empty login body returns 4xx (got ${r6.status})`);
  } else {
    fail(`Empty login body should fail`, `got HTTP ${r6.status}`);
  }

  // 1h. Phone number login
  const r7 = await req('POST', '/api/auth/login', { identifier: '9876543210', password: 'password123' });
  if (r7.status === 200 && r7.body.token) {
    pass(`Phone login works (user: ${r7.body.name})`);
  } else {
    fail(`Phone login should work`, `HTTP ${r7.status}: ${JSON.stringify(r7.body)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SUITE 2 — Priest Search & Discovery
// ═══════════════════════════════════════════════════════════════════════
async function suitePriestSearch() {
  suite('2. Priest Search & Discovery');

  // 2a. List all priests (public)
  const r1 = await req('GET', '/api/devotee/priests');
  if (r1.status === 200 && r1.body.priests?.length > 0) {
    state.priestProfileId = r1.body.priests[0]._id;
    pass(`GET /priests returns list (${r1.body.priests.length} priests)`, `first: ${r1.body.priests[0].name}`);
  } else {
    fail('GET /priests should return non-empty list', `HTTP ${r1.status}`);
  }

  // 2b. Get specific priest details
  if (state.priestProfileId) {
    const r2 = await req('GET', `/api/devotee/priests/${state.priestProfileId}`);
    if (r2.status === 200 && r2.body.name) {
      pass(`GET /priests/:id returns priest profile (${r2.body.name})`);
    } else {
      fail('GET /priests/:id should return priest details', `HTTP ${r2.status}`);
    }
  }

  // 2c. Get non-existent priest ID
  const r3 = await req('GET', '/api/devotee/priests/000000000000000000000000');
  // Should return 404 or fallback demo data
  if (r3.status === 404) {
    pass('Non-existent priestId returns 404');
  } else if (r3.status === 200) {
    fail('Non-existent priestId should return 404, but returns 200 (returns demo data fallback)', `name: ${r3.body.name}`);
  } else {
    fail('Non-existent priestId unexpected response', `HTTP ${r3.status}`);
  }

  // 2d. Search with religion filter
  const r4 = await req('GET', '/api/devotee/priests?religion=Hindu');
  if (r4.status === 200) {
    pass(`Search with religion filter returns ${r4.status}`, `${r4.body.priests?.length || 0} results`);
  } else {
    fail('Religion filter search failed', `HTTP ${r4.status}`);
  }

  // 2e. Search with city filter
  const r5 = await req('GET', '/api/devotee/priests?city=Bangalore');
  if (r5.status === 200) {
    pass(`Search with city filter returns results`, `${r5.body.priests?.length || 0} results`);
  } else {
    fail('City filter search failed', `HTTP ${r5.status}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SUITE 3 — Booking Creation Validation
// ═══════════════════════════════════════════════════════════════════════
async function suiteBookingValidation() {
  suite('3. Booking Creation Validation');
  if (!state.devoteeToken || !state.priestProfileId) {
    fail('SKIPPED — missing tokens from Suite 1/2');
    return;
  }

  // 3a. Missing required fields
  const r1 = await req('POST', '/api/devotee/bookings', { priestId: state.priestProfileId }, state.devoteeToken);
  if (r1.status === 400) {
    pass('Missing fields returns 400', r1.body.message);
  } else {
    fail('Missing fields should return 400', `got HTTP ${r1.status}: ${r1.body.message}`);
  }

  // 3b. Missing location.city
  const r2 = await req('POST', '/api/devotee/bookings', {
    ...BASE_BOOKING(), location: { address: '1 Test Lane' } // no city
  }, state.devoteeToken);
  if (r2.status === 400) {
    pass('Missing location.city returns 400');
  } else {
    fail('Missing location.city should return 400', `got HTTP ${r2.status}`);
  }

  // 3c. Invalid priestId (random ObjectId that doesn't exist)
  const r3 = await req('POST', '/api/devotee/bookings', {
    ...BASE_BOOKING(), priestId: '000000000000000000000000'
  }, state.devoteeToken);
  if (r3.status === 400 || r3.status === 404) {
    pass('Invalid priestId returns 4xx', r3.body.message);
  } else {
    fail('Invalid priestId should fail with 4xx', `got HTTP ${r3.status}`);
  }

  // 3d. Booking without auth
  const r4 = await req('POST', '/api/devotee/bookings', BASE_BOOKING(), null);
  if (r4.status === 401) {
    pass('Unauthenticated booking returns 401');
  } else {
    fail('Unauthenticated booking should return 401', `got HTTP ${r4.status}`);
  }

  // 3e. Priest trying to create a booking (should be devotee only)
  const r5 = await req('POST', '/api/devotee/bookings', BASE_BOOKING(), state.priestToken);
  if (r5.status === 403) {
    pass('Priest cannot create a devotee booking (403 Forbidden)');
  } else {
    fail('Priest creating a booking should return 403', `got HTTP ${r5.status}: ${JSON.stringify(r5.body)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SUITE 4 — Full Booking Lifecycle
// ═══════════════════════════════════════════════════════════════════════
async function suiteBookingLifecycle() {
  suite('4. Full Booking Lifecycle');
  if (!state.devoteeToken || !state.priestProfileId) {
    fail('SKIPPED — missing tokens');
    return;
  }

  // 4a. Create valid booking
  const r1 = await req('POST', '/api/devotee/bookings', BASE_BOOKING(), state.devoteeToken);
  if (r1.status === 201) {
    state.bookingId = r1.body._id;
    pass('Create booking returns 201', `ID: ${state.bookingId}, Status: ${r1.body.status}`);
    if (r1.body.status === 'pending') pass('New booking starts as pending');
    else fail('New booking status should be pending', `got: ${r1.body.status}`);
  } else {
    fail('Create booking failed', `HTTP ${r1.status}: ${JSON.stringify(r1.body)}`);
    return;
  }

  // 4b. Devotee can see their booking
  const r2 = await req('GET', '/api/devotee/bookings', null, state.devoteeToken);
  if (r2.status === 200) {
    const bookings = Array.isArray(r2.body) ? r2.body : [];
    const found = bookings.find(b => b._id === state.bookingId);
    found ? pass('Devotee can fetch their booking') : fail('Booking not found in devotee list');
  } else {
    fail('GET /devotee/bookings failed', `HTTP ${r2.status}`);
  }

  // 4c. Priest sees the booking in their list
  const r3 = await req('GET', '/api/priest/bookings', null, state.priestToken);
  if (r3.status === 200) {
    const bookings = Array.isArray(r3.body) ? r3.body : r3.body?.data || [];
    const found = bookings.find(b => b._id === state.bookingId);
    found ? pass('Priest can see the pending booking') : fail('Booking not in priest list', `${bookings.length} bookings returned`);
  } else {
    fail('GET /priest/bookings failed', `HTTP ${r3.status}`);
  }

  // 4d. Devotee cannot change booking status (only priest should)
  const r4 = await req('PUT', `/api/bookings/${state.bookingId}/status`, { status: 'confirmed' }, state.devoteeToken);
  if (r4.status === 403) {
    pass('Devotee cannot accept/reject a booking (403)');
  } else if (r4.status === 200) {
    fail('Devotee should NOT be able to change booking status — no role check!', 'SECURITY BUG');
  } else {
    fail('Unexpected status when devotee tries to change booking', `HTTP ${r4.status}`);
  }

  // 4e. Priest accepts booking
  const r5 = await req('PUT', `/api/bookings/${state.bookingId}/status`, { status: 'confirmed' }, state.priestToken);
  if (r5.status === 200) {
    pass('Priest can accept booking');
    const status = r5.body.booking?.status || r5.body.status;
    status === 'confirmed' ? pass('Status updated to confirmed') : fail('Status not confirmed in response', `got: ${status}`);
  } else {
    fail('Priest accept booking failed', `HTTP ${r5.status}: ${JSON.stringify(r5.body)}`);
  }

  // 4f. Devotee sees confirmed booking
  const r6 = await req('GET', '/api/devotee/bookings', null, state.devoteeToken);
  if (r6.status === 200) {
    const bookings = Array.isArray(r6.body) ? r6.body : [];
    const found = bookings.find(b => b._id === state.bookingId);
    found?.status === 'confirmed'
      ? pass('Devotee sees confirmed status after priest acceptance')
      : fail('Booking status not confirmed for devotee', `got: ${found?.status}`);
  }

  // 4g. Priest marks booking as completed
  const r7 = await req('POST', `/api/bookings/${state.bookingId}/complete`, {}, state.priestToken);
  if (r7.status === 200) {
    pass('Priest can mark booking as completed');
  } else {
    fail('Mark as completed failed', `HTTP ${r7.status}: ${JSON.stringify(r7.body)}`);
  }

  // 4h. Create a second booking and REJECT it
  const r8 = await req('POST', '/api/devotee/bookings', { ...BASE_BOOKING(), date: futureDate(10) }, state.devoteeToken);
  if (r8.status === 201) {
    state.bookingId2 = r8.body._id;
    pass('Second booking created for reject test', `ID: ${state.bookingId2}`);

    const r9 = await req('PUT', `/api/bookings/${state.bookingId2}/status`, { status: 'cancelled' }, state.priestToken);
    if (r9.status === 200) {
      pass('Priest can reject/cancel a booking');
    } else {
      fail('Priest rejection failed', `HTTP ${r9.status}`);
    }
  } else {
    fail('Second booking creation failed', `HTTP ${r8.status}: ${JSON.stringify(r8.body)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SUITE 5 — Notifications
// ═══════════════════════════════════════════════════════════════════════
async function suiteNotifications() {
  suite('5. Notifications');
  await new Promise(r => setTimeout(r, 500));

  // 5a. Devotee has notifications
  const r1 = await req('GET', '/api/devotee/notifications', null, state.devoteeToken);
  if (r1.status === 200) {
    const notifs = Array.isArray(r1.body) ? r1.body : [];
    pass(`GET /devotee/notifications returns ${notifs.length} notifications`);

    // 5b. Accept/reject notifications present
    const acceptNotif = notifs.find(n => n.title?.includes('Accepted') || n.message?.includes('accepted'));
    const rejectNotif = notifs.find(n => n.title?.includes('Declined') || n.message?.includes('declined'));
    acceptNotif ? pass('"Booking Accepted" notification exists', acceptNotif.message?.substring(0, 60))
                : fail('"Booking Accepted" notification missing');
    rejectNotif ? pass('"Booking Declined" notification exists', rejectNotif.message?.substring(0, 60))
                : fail('"Booking Declined" notification missing');

    if (notifs.length > 0) {
      state.notificationId = notifs[0]._id;

      // 5c. Mark single notification as read
      const r2 = await req('PUT', `/api/devotee/notifications/${state.notificationId}/read`, {}, state.devoteeToken);
      if (r2.status === 200) {
        pass('Mark notification as read works');
      } else {
        fail('Mark notification as read failed', `HTTP ${r2.status}: ${JSON.stringify(r2.body)}`);
      }

      // 5d. Mark all as read
      const r3 = await req('PUT', '/api/devotee/notifications/mark-all-read', {}, state.devoteeToken);
      if (r3.status === 200) {
        pass('Mark all notifications as read works');
      } else {
        fail('Mark all notifications as read failed', `HTTP ${r3.status}: ${JSON.stringify(r3.body)}`);
      }
    }
  } else {
    fail('GET /devotee/notifications failed', `HTTP ${r1.status}`);
  }

  // 5e. Priest notifications
  const r4 = await req('GET', '/api/priest/notifications', null, state.priestToken);
  if (r4.status === 200) {
    const notifs = Array.isArray(r4.body) ? r4.body : [];
    pass(`GET /priest/notifications returns ${notifs.length} notifications`);
  } else {
    fail('GET /priest/notifications failed', `HTTP ${r4.status}`);
  }

  // 5f. Devotee cannot access priest notifications
  const r5 = await req('GET', '/api/priest/notifications', null, state.devoteeToken);
  if (r5.status === 403) {
    pass('Devotee cannot access priest notifications (403)');
  } else {
    fail('Devotee accessing priest notifications should return 403', `HTTP ${r5.status}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SUITE 6 — Reviews & Ratings
// ═══════════════════════════════════════════════════════════════════════
async function suiteReviews() {
  suite('6. Reviews & Ratings');
  if (!state.bookingId) { fail('SKIPPED — no booking available'); return; }

  // 6a. Submit a review for the completed booking
  const reviewPayload = {
    bookingId: state.bookingId,
    priestId: state.priestId,  // User ID of priest
    rating: 5,
    review: 'Excellent service! Very punctual and knowledgeable.',
  };
  const r1 = await req('POST', '/api/reviews/submit', reviewPayload, state.devoteeToken);
  if (r1.status === 201 || r1.status === 200) {
    pass('Submit review returns 2xx');
  } else {
    fail('Submit review failed', `HTTP ${r1.status}: ${JSON.stringify(r1.body)}`);
  }

  // 6b. Submitting the same review twice should fail or deduplicate
  const r2 = await req('POST', '/api/reviews/submit', reviewPayload, state.devoteeToken);
  if (r2.status === 400 || r2.status === 409) {
    pass('Duplicate review returns 4xx (deduplication works)');
  } else if (r2.status === 201 || r2.status === 200) {
    fail('Duplicate review allowed — no deduplication!', 'BUG: same booking can be reviewed twice');
  } else {
    fail('Duplicate review unexpected response', `HTTP ${r2.status}`);
  }

  // 6c. Invalid rating (> 5)
  const r3 = await req('POST', '/api/reviews/submit', {
    ...reviewPayload, bookingId: state.bookingId2, rating: 10
  }, state.devoteeToken);
  if (r3.status === 400) {
    pass('Rating > 5 returns 400 (validation works)');
  } else if (r3.status === 201 || r3.status === 200) {
    fail('Rating > 5 was accepted — no validation!', 'BUG: invalid rating accepted');
  } else {
    fail('Rating > 5 unexpected response', `HTTP ${r3.status}`);
  }

  // 6d. Get reviews for a user
  if (state.priestId) {
    const r4 = await req('GET', `/api/reviews/user/${state.priestId}`);
    if (r4.status === 200) {
      const reviews = Array.isArray(r4.body) ? r4.body : r4.body?.reviews || [];
      pass(`Get user reviews returns ${reviews.length} reviews`);
    } else {
      fail('Get user reviews failed', `HTTP ${r4.status}`);
    }
  }

  // 6e. Pending actions — devotee sees completed-but-unrated bookings
  const r5 = await req('GET', '/api/devotee/pending-actions', null, state.devoteeToken);
  if (r5.status === 200) {
    const actions = Array.isArray(r5.body) ? r5.body : [];
    pass(`GET /pending-actions returns ${actions.length} actions`);
  } else {
    fail('GET /pending-actions failed', `HTTP ${r5.status}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SUITE 7 — Priest Profile & Dashboard
// ═══════════════════════════════════════════════════════════════════════
async function suitePriestDashboard() {
  suite('7. Priest Profile & Dashboard');
  if (!state.priestToken) { fail('SKIPPED — no priest token'); return; }

  // 7a. Get priest profile
  const r1 = await req('GET', '/api/priest/profile', null, state.priestToken);
  if (r1.status === 200) {
    pass('GET /priest/profile returns 200', `name: ${r1.body.name || r1.body.userId?.name}`);
  } else {
    fail('GET /priest/profile failed', `HTTP ${r1.status}`);
  }

  // 7b. Get priest earnings
  const r2 = await req('GET', '/api/priest/earnings', null, state.priestToken);
  if (r2.status === 200) {
    pass('GET /priest/earnings returns 200', `thisMonth: ${JSON.stringify(r2.body.thisMonth || r2.body.month || {})}`);
  } else {
    fail('GET /priest/earnings failed', `HTTP ${r2.status}`);
  }

  // 7c. Get priest pending actions
  const r3 = await req('GET', '/api/priest/bookings/pending-actions', null, state.priestToken);
  if (r3.status === 200) {
    pass(`GET /priest/bookings/pending-actions returns ${Array.isArray(r3.body) ? r3.body.length : '?'} actions`);
  } else {
    fail('GET priest pending-actions failed', `HTTP ${r3.status}: ${JSON.stringify(r3.body)}`);
  }

  // 7d. Devotee using priest endpoints should fail
  const r4 = await req('GET', '/api/priest/profile', null, state.devoteeToken);
  if (r4.status === 403) {
    pass('Devotee cannot access priest profile endpoint (403)');
  } else {
    fail('Devotee accessing priest profile should return 403', `HTTP ${r4.status}`);
  }

  // 7e. Update priest status (toggle availability)
  const r5 = await req('PUT', '/api/priest/status', { status: 'busy' }, state.priestToken);
  if (r5.status === 200) {
    pass('Toggle priest status works');
  } else {
    fail('Toggle priest status failed', `HTTP ${r5.status}: ${JSON.stringify(r5.body)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SUITE 8 — Address Management
// ═══════════════════════════════════════════════════════════════════════
async function suiteAddresses() {
  suite('8. Address Management');
  if (!state.devoteeToken) { fail('SKIPPED — no devotee token'); return; }

  const newAddr = {
    label: 'Home',
    address: '42 Elm Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    isDefault: true,
  };

  // 8a. Add new address
  const r1 = await req('POST', '/api/devotee/addresses', newAddr, state.devoteeToken);
  if (r1.status === 201 || r1.status === 200) {
    const addrs = Array.isArray(r1.body) ? r1.body : [];
    state.addressId = addrs.find(a => a.city === 'Mumbai')?._id;
    pass(`Add address returns ${r1.status}`, `addressId: ${state.addressId}`);
  } else {
    fail('Add address failed', `HTTP ${r1.status}: ${JSON.stringify(r1.body)}`);
  }

  // 8b. Get addresses
  const r2 = await req('GET', '/api/devotee/addresses', null, state.devoteeToken);
  if (r2.status === 200) {
    pass(`GET addresses returns ${Array.isArray(r2.body) ? r2.body.length : '?'} addresses`);
  } else {
    fail('GET addresses failed', `HTTP ${r2.status}`);
  }

  // 8c. Update address
  if (state.addressId) {
    const r3 = await req('PUT', `/api/devotee/addresses/${state.addressId}`, { city: 'Pune' }, state.devoteeToken);
    if (r3.status === 200) {
      pass('Update address returns 200');
    } else {
      fail('Update address failed', `HTTP ${r3.status}: ${JSON.stringify(r3.body)}`);
    }

    // 8d. Delete address
    const r4 = await req('DELETE', `/api/devotee/addresses/${state.addressId}`, null, state.devoteeToken);
    if (r4.status === 200) {
      pass('Delete address returns 200');
    } else {
      fail('Delete address failed', `HTTP ${r4.status}: ${JSON.stringify(r4.body)}`);
    }
  }

  // 8e. Unauthenticated access
  const r5 = await req('GET', '/api/devotee/addresses', null, null);
  if (r5.status === 401) {
    pass('Unauthenticated address access returns 401');
  } else {
    fail('Unauthenticated address access should return 401', `HTTP ${r5.status}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SUITE 9 — Security & Edge Cases
// ═══════════════════════════════════════════════════════════════════════
async function suiteSecurity() {
  suite('9. Security & Edge Cases');

  // 9a. Fake/expired JWT
  const r1 = await req('GET', '/api/devotee/bookings', null, 'Bearer fake.jwt.token');
  if (r1.status === 401) {
    pass('Fake JWT returns 401');
  } else {
    fail('Fake JWT should return 401', `HTTP ${r1.status}`);
  }

  // 9b. SQL injection in login identifier
  const r2 = await req('POST', '/api/auth/login', { identifier: "' OR '1'='1", password: 'x' });
  if (r2.status !== 200) {
    pass('SQL injection attempt in login rejected');
  } else {
    fail('SQL injection in login should fail', 'SECURITY BUG: login succeeded with injection payload');
  }

  // 9c. Access another devotee's bookings using their own token
  // (Cross-user data access: devotee1 should not see devotee2's notifications)
  const r3 = await req('GET', '/api/devotee/notifications', null, state.devotee2Token);
  if (r3.status === 200) {
    const notifs = Array.isArray(r3.body) ? r3.body : [];
    // They should only see THEIR notifications, not the other devotee's
    const crossed = notifs.find(n => n.userId && n.userId === state.devoteeId);
    if (!crossed) {
      pass('Devotee2 cannot see Devotee1 notifications (data isolation OK)');
    } else {
      fail('Devotee2 can see Devotee1 notifications!', 'SECURITY BUG: cross-user notification leak');
    }
  }

  // 9d. Booking with past date
  const r4 = await req('POST', '/api/devotee/bookings', {
    ...BASE_BOOKING(), date: pastDate(5)
  }, state.devoteeToken);
  if (r4.status === 400) {
    pass('Booking with past date returns 400');
  } else if (r4.status === 201) {
    fail('Booking with past date was accepted', 'BUG: past date bookings should be rejected');
  } else {
    fail('Booking with past date unexpected response', `HTTP ${r4.status}`);
  }

  // 9e. Change booking status to invalid value
  if (state.bookingId2) {
    const r5 = await req('PUT', `/api/bookings/${state.bookingId2}/status`, { status: 'foobar' }, state.priestToken);
    if (r5.status === 400) {
      pass('Invalid booking status value returns 400');
    } else if (r5.status === 200) {
      fail('Invalid booking status accepted', 'BUG: status enum validation missing');
    } else {
      fail('Invalid booking status unexpected response', `HTTP ${r5.status}`);
    }
  }

  // 9f. Very long ceremony type string
  const r6 = await req('POST', '/api/devotee/bookings', {
    ...BASE_BOOKING(), ceremonyType: 'A'.repeat(1000)
  }, state.devoteeToken);
  if (r6.status === 400) {
    pass('Extremely long ceremonyType returns 400');
  } else if (r6.status === 201) {
    fail('Extremely long ceremonyType accepted', 'BUG: no max-length validation on ceremonyType');
  } else {
    fail('Long ceremonyType unexpected response', `HTTP ${r6.status}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SUITE 10 — Concurrent / Double-Action Edge Cases
// ═══════════════════════════════════════════════════════════════════════
async function suiteEdgeCases() {
  suite('10. Concurrent / State Machine Edge Cases');

  // 10a. Create a fresh booking and try to accept it twice
  if (!state.devoteeToken || !state.priestProfileId) {
    fail('SKIPPED — missing tokens'); return;
  }

  const freshB = await req('POST', '/api/devotee/bookings', {
    ...BASE_BOOKING(), date: futureDate(15)
  }, state.devoteeToken);

  if (freshB.status === 201) {
    const fBid = freshB.body._id;
    pass('Fresh booking created for edge case tests', `ID: ${fBid}`);

    // Accept it
    const acc1 = await req('PUT', `/api/bookings/${fBid}/status`, { status: 'confirmed' }, state.priestToken);
    if (acc1.status === 200) pass('First accept OK');

    // Try to accept again (already confirmed)
    const acc2 = await req('PUT', `/api/bookings/${fBid}/status`, { status: 'confirmed' }, state.priestToken);
    if (acc2.status === 400) {
      pass('Double-accept returns 400 (idempotency guard)');
    } else if (acc2.status === 200) {
      fail('Double-accept on already-confirmed booking allowed', 'BUG: no state-machine guard — booking can be re-confirmed');
    } else {
      fail('Double-accept unexpected response', `HTTP ${acc2.status}`);
    }

    // Try to cancel a confirmed booking (should this be allowed?)
    const cancel = await req('PUT', `/api/bookings/${fBid}/status`, { status: 'cancelled' }, state.priestToken);
    if (cancel.status === 400) {
      pass('Cannot cancel an already-confirmed booking (correct state-machine)');
    } else if (cancel.status === 200) {
      fail('A confirmed booking can be cancelled by putting status=cancelled', 'NOTE: May be intentional but check business rules');
    } else {
      fail('Cancel-confirmed unexpected response', `HTTP ${cancel.status}`);
    }
  } else {
    fail('Fresh booking creation failed', `HTTP ${freshB.status}`);
  }

  // 10b. Mark as complete without being confirmed first (pending -> complete is invalid)
  const anotherB = await req('POST', '/api/devotee/bookings', {
    ...BASE_BOOKING(), date: futureDate(20)
  }, state.devoteeToken);

  if (anotherB.status === 201) {
    const abid = anotherB.body._id;
    const complete = await req('POST', `/api/bookings/${abid}/complete`, {}, state.priestToken);
    if (complete.status === 400) {
      pass('Cannot mark a pending booking as complete (correct)');
    } else if (complete.status === 200) {
      fail('Pending booking marked as complete without being confirmed', 'BUG: state machine not enforced on /complete');
    } else {
      fail('Mark pending as complete unexpected response', `HTTP ${complete.status}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════
async function printSummary() {
  console.log('\n' + '═'.repeat(60));
  console.log('  FINAL SUMMARY');
  console.log('═'.repeat(60));

  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);

  console.log(`\n  Total: ${results.length} | Passed: ${passed.length} | Failed: ${failed.length}\n`);

  if (failed.length > 0) {
    console.log('  FAILURES:');
    failed.forEach(r => {
      console.log(`    ❌ [${r.suite}] ${r.name}`);
      if (r.detail) console.log(`         ${r.detail}`);
    });
  }

  // Write structured JSON for bug report
  const fs = require('fs');
  fs.writeFileSync('./test_results.json', JSON.stringify({ passed: passed.length, failed: failed.length, results }, null, 2), 'utf8');
  console.log('\n  Results written to test_results.json');
}

// ─── main runner ──────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  SACRED CONNECT — COMPREHENSIVE TEST SUITE');
  console.log(`  ${new Date().toLocaleString('en-IN')}`);
  console.log('═'.repeat(60));

  await suiteAuth();
  await suitePriestSearch();
  await suiteBookingValidation();
  await suiteBookingLifecycle();
  await suiteNotifications();
  await suiteReviews();
  await suitePriestDashboard();
  await suiteAddresses();
  await suiteSecurity();
  await suiteEdgeCases();
  await printSummary();
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err.message);
  process.exit(1);
});
