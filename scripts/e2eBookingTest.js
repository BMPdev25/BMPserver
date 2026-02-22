/**
 * E2E Test: Full Booking Request Flow
 *
 * Tests:
 *  1. Login as devotee  
 *  2. List priests → pick the first one  
 *  3. Create a booking (pending)  
 *  4. Login as priest  
 *  5. Verify booking appears in priest's pending list  
 *  6. Priest ACCEPTS the booking → status becomes 'confirmed'  
 *  7. Verify a Notification was created for the devotee  
 *  8. Login again as devotee → check /api/devotee/bookings shows 'confirmed'  
 *  9. Login again as devotee → check /api/devotee/notifications has 'Booking Accepted' notification  
 * 10. Priest REJECTS a NEW booking → verify 'Booking Declined' notification  
 */

const http = require('http');

const BASE = 'http://localhost:5000';

// ─── helpers ────────────────────────────────────────────────────────────────

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function pass(msg) { console.log(`  ✅  ${msg}`); }
function fail(msg) { console.log(`  ❌  ${msg}`); }
function section(msg) { console.log(`\n──── ${msg} ────`); }

// ─── main ────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n🕉️  Sacred Connect — E2E Booking Flow Test\n');

  // ── STEP 1: Login as devotee ───────────────────────────────────────────────
  section('Step 1: Login as devotee');
  const devoteeLogin = await request('POST', '/api/auth/login', {
    identifier: 'devotee@example.com',
    password: 'password123',
  });

  if (devoteeLogin.status !== 200 || !devoteeLogin.body.token) {
    fail(`Devotee login failed (HTTP ${devoteeLogin.status}): ${JSON.stringify(devoteeLogin.body)}`);
    
    // Try alternate credentials
    console.log('  ℹ️  Trying alternate devotee credentials...');
    const alternates = [
      { identifier: 'devotee1@example.com', password: 'password123' },
      { identifier: 'anish@bmp.com', password: 'password123' },
    ];
    let loggedIn = false;
    for (const cred of alternates) {
      const alt = await request('POST', '/api/auth/login', cred);
      if (alt.status === 200 && alt.body.token) {
        Object.assign(devoteeLogin, alt);
        loggedIn = true;
        break;
      }
    }
    if (!loggedIn) {
      fail('All devotee login attempts failed. Please check test credentials.');
      process.exit(1);
    }
  }

  const devoteeToken = devoteeLogin.body.token;
  const devoteeId = devoteeLogin.body._id;
  pass(`Logged in as devotee: ${devoteeLogin.body.name || devoteeLogin.body.email} (ID: ${devoteeId})`);

  // ── STEP 2: List priests ───────────────────────────────────────────────────
  section('Step 2: Find an available priest');
  const priestsRes = await request('GET', '/api/devotee/priests', null, devoteeToken);
  
  let priestProfileId, priestUserId, priestName;
  if (priestsRes.status === 200) {
    const priests = priestsRes.body.priests || priestsRes.body;
    if (!Array.isArray(priests) || priests.length === 0) {
      fail('No priests found in DB');
      process.exit(1);
    }
    const priest = priests[0];
    priestProfileId = priest._id;
    priestName = priest.name;
    pass(`Found priest: ${priestName} (Profile ID: ${priestProfileId})`);
  } else {
    fail(`Could not list priests (HTTP ${priestsRes.status})`);
    process.exit(1);
  }

  // ── STEP 3: Create booking (devotee → priest) ─────────────────────────────
  section('Step 3: Create booking (devotee → priest)');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 3);
  const bookingDate = tomorrow.toISOString().split('T')[0];

  const bookingPayload = {
    priestId: priestProfileId,
    ceremonyType: 'Satyanarayan Puja',
    date: bookingDate,
    startTime: '10:00',
    endTime: '12:00',
    location: { address: '123 Test Street', city: 'Bangalore', state: 'Karnataka', pincode: '560001' },
    basePrice: 5000,
    platformFee: 250,    // 5% platform fee
    totalAmount: 5250,
    paymentStatus: 'pending',
  };

  const createRes = await request('POST', '/api/devotee/bookings', bookingPayload, devoteeToken);

  if (createRes.status !== 201) {
    fail(`Create booking failed (HTTP ${createRes.status}): ${JSON.stringify(createRes.body)}`);
    process.exit(1);
  }

  const createdBooking = createRes.body;
  const bookingId = createdBooking._id;
  priestUserId = createdBooking.priestId?._id || createdBooking.priestId;
  pass(`Booking created! ID: ${bookingId}, Status: ${createdBooking.status}, Priest UserID: ${priestUserId}`);

  if (createdBooking.status !== 'pending') {
    fail(`Expected status 'pending', got '${createdBooking.status}'`);
  } else {
    pass(`Booking status is correctly 'pending'`);
  }

  // ── STEP 4: Login as priest ─────────────────────────────────────────────────
  section('Step 4: Login as priest');
  // We need to find the priest's login credentials. Try common test ones.
  let priestToken;
  const priestCreds = [
    { identifier: 'priest1@example.com', password: 'password123' },
    { identifier: 'priest2@example.com', password: 'password123' },
    { identifier: 'test@mail.com', password: 'password123' },
  ];

  for (const cred of priestCreds) {
    const r = await request('POST', '/api/auth/login', cred);
    if (r.status === 200 && r.body.token && (r.body.userType === 'priest' || r.body.role === 'priest')) {
      priestToken = r.body.token;
      pass(`Logged in as priest: ${r.body.name || cred.identifier}`);
      break;
    }
  }

  if (!priestToken) {
    fail('Could not log in as any priest with known test credentials. Listing users to help debug...');
    // Try to get all users info (if there's a debug endpoint)
    const usersRes = await request('GET', '/api/devotee/priests', null, devoteeToken);
    console.log('  Available priest profiles:', JSON.stringify(usersRes.body?.priests?.map(p => p.name) || []));
    process.exit(1);
  }

  // ── STEP 5: Verify booking appears in priest's list ────────────────────────
  section('Step 5: Priest sees the pending booking');
  const priestBookingsRes = await request('GET', '/api/priest/bookings', null, priestToken);

  if (priestBookingsRes.status !== 200) {
    fail(`Priest bookings fetch failed (HTTP ${priestBookingsRes.status})`);
  } else {
    const bookings = Array.isArray(priestBookingsRes.body) ? priestBookingsRes.body : priestBookingsRes.body?.data || [];
    const found = bookings.find(b => b._id === bookingId);
    if (found) {
      pass(`Booking ${bookingId} found in priest's list with status: ${found.status}`);
    } else {
      fail(`Booking ${bookingId} NOT found in priest's booking list`);
      console.log('  Priest bookings:', bookings.map(b => `${b._id} (${b.status})`).join(', '));
    }
  }

  // ── STEP 6: Priest ACCEPTS the booking ────────────────────────────────────
  section('Step 6: Priest accepts the booking');
  const acceptRes = await request('PUT', `/api/bookings/${bookingId}/status`, {
    status: 'confirmed',
    note: 'E2E test acceptance',
  }, priestToken);

  if (acceptRes.status !== 200) {
    fail(`Accept failed (HTTP ${acceptRes.status}): ${JSON.stringify(acceptRes.body)}`);
    process.exit(1);
  }

  pass(`Booking accepted! New status: ${acceptRes.body.booking?.status || acceptRes.body.status}`);

  const confirmedStatus = acceptRes.body.booking?.status || acceptRes.body.status;
  if (confirmedStatus !== 'confirmed') {
    fail(`Expected status 'confirmed', got '${confirmedStatus}'`);
  } else {
    pass(`Status correctly updated to 'confirmed'`);
  }

  // ── STEP 7: Devotee sees booking as 'confirmed' ────────────────────────────
  section('Step 7: Devotee sees confirmed booking');
  const devoteeBookings = await request('GET', '/api/devotee/bookings', null, devoteeToken);
  if (devoteeBookings.status === 200) {
    const bookings = Array.isArray(devoteeBookings.body) ? devoteeBookings.body : devoteeBookings.body?.data || [];
    const confirmed = bookings.find(b => b._id === bookingId);
    if (confirmed) {
      if (confirmed.status === 'confirmed') {
        pass(`Booking shows 'confirmed' status for devotee ✓`);
      } else {
        fail(`Booking status for devotee is '${confirmed.status}' (expected 'confirmed')`);
      }
    } else {
      fail(`Booking ${bookingId} not found in devotee's bookings`);
    }
  } else {
    fail(`Could not fetch devotee bookings (HTTP ${devoteeBookings.status})`);
  }

  // ── STEP 8: Devotee has 'Booking Accepted' notification ───────────────────
  section('Step 8: Devotee notification — "Booking Accepted"');
  // Wait a beat for the notification to be saved
  await new Promise(r => setTimeout(r, 500));
  
  const devoteeNotifs = await request('GET', '/api/devotee/notifications', null, devoteeToken);
  if (devoteeNotifs.status === 200) {
    const notifs = Array.isArray(devoteeNotifs.body) ? devoteeNotifs.body : [];
    const acceptNotif = notifs.find(n => 
      n.relatedId === bookingId || 
      (n.title && n.title.toLowerCase().includes('accept')) ||
      (n.message && n.message.toLowerCase().includes('accept'))
    );
    if (acceptNotif) {
      pass(`Notification found: "${acceptNotif.title}" — ${acceptNotif.message}`);
    } else {
      fail(`No 'Booking Accepted' notification found for devotee`);
      console.log(`  All notifications (${notifs.length}):`);
      notifs.forEach(n => console.log(`    - [${n.title}] ${n.message}`));
    }
  } else {
    fail(`Could not fetch devotee notifications (HTTP ${devoteeNotifs.status})`);
  }

  // ── STEP 9: TEST REJECT — create another booking, then reject ──────────────
  section('Step 9: Test REJECT flow');
  tomorrow.setDate(tomorrow.getDate() + 1); // one day further
  const bookingDate2 = tomorrow.toISOString().split('T')[0];
  const createRes2 = await request('POST', '/api/devotee/bookings', 
    { ...bookingPayload, date: bookingDate2 }, devoteeToken);
  
  if (createRes2.status !== 201) {
    fail(`Second booking creation failed (HTTP ${createRes2.status}): ${JSON.stringify(createRes2.body)}`);
  } else {
    const bookingId2 = createRes2.body._id;
    pass(`Second booking created: ${bookingId2}`);

    const rejectRes = await request('PUT', `/api/bookings/${bookingId2}/status`, {
      status: 'cancelled',
      note: 'E2E test rejection',
    }, priestToken);

    if (rejectRes.status !== 200) {
      fail(`Reject failed (HTTP ${rejectRes.status}): ${JSON.stringify(rejectRes.body)}`);
    } else {
      pass(`Second booking rejected! Status: ${rejectRes.body.booking?.status || rejectRes.body.status}`);

      // Check for decline notification
      await new Promise(r => setTimeout(r, 500));
      const notifs2 = await request('GET', '/api/devotee/notifications', null, devoteeToken);
      if (notifs2.status === 200) {
        const notifsList = Array.isArray(notifs2.body) ? notifs2.body : [];
        const declineNotif = notifsList.find(n =>
          n.relatedId === bookingId2 ||
          (n.title && n.title.toLowerCase().includes('declin')) ||
          (n.message && n.message.toLowerCase().includes('declin'))
        );
        if (declineNotif) {
          pass(`Decline notification found: "${declineNotif.title}" — ${declineNotif.message}`);
        } else {
          fail(`No decline notification found`);
          console.log(`  All notifications (${notifsList.length}):`);
          notifsList.slice(0, 5).forEach(n => console.log(`    - [${n.title}] ${n.message}`));
        }
      }
    }
  }

  // ── DONE ──────────────────────────────────────────────────────────────────
  console.log('\n🏁  E2E Test Complete\n');
}

run().catch(err => {
  console.error('\n💥 Unhandled error:', err.message);
  process.exit(1);
});
