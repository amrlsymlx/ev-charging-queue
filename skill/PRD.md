# EV Charging Queue System

## Overview

A simple EV Charging Queue System for showroom customers.

Customers arrive at the showroom and scan a QR code to join the charging queue.

The system manages:

- Queue registration
- Live queue tracking
- Charging bay management
- Charging sessions
- Queue history
- GPS validation

The system does NOT directly control the charger.

Service Advisors (SA) manually start/end charging from the dashboard.

---

# Business Goals

## Customer Goals

- Easily join charging queue
- Track queue position
- View estimated waiting time
- View charging progress

## SA Goals

- View live queue
- Start charging session
- End charging session
- Skip queue
- Remove queue entries

## Management Goals

- Record all charging activities
- View charging history
- Track charger utilization

---

# Charging Rules

## Bays

Total Charging Bays: 2

Bay Names:

- Bay 1
- Bay 2

---

## Charging Duration

Default:

- Charging Duration: 60 minutes
- Buffer: 5 minutes

Total Slot Duration:

65 minutes

SA may manually adjust duration.

---

## Queue Policy

Queue Type:

First Come First Serve (FCFS)

Single shared queue.

Example:

Bay 1
ABC1234

Bay 2
DEF4567

Waiting

#1 XYZ8888
#2 AAA1111
#3 BBB2222

---

## Customer Registration

Required Fields:

- Name
- Phone Number
- Car Plate Number
- Battery Percentage

No appointment required.

Walk-in only.

---

## GPS Validation

Customer must be within:

50 meters

from showroom location.

If validation fails:

Customer submits override request.

SA can:

- Approve
- Reject

---

# Customer Features

## Join Queue

Customer scans QR code.

System:

1. Validate GPS
2. Display registration form
3. Create queue entry
4. Redirect to queue status screen

---

## Queue Status

Customer can view:

- Current charging bays
- Vehicles charging
- Remaining charging time
- Waiting queue
- Current position
- Estimated waiting time

---

## Queue Lookup

Customer can retrieve queue using:

Car Plate Number

---

# SA Features

## Dashboard

View:

- Bay 1 status
- Bay 2 status
- Active charging sessions
- Waiting queue

---

## Charging Actions

SA can:

- Start Charging
- End Charging
- Skip Queue
- Remove Queue Entry

---

## GPS Override

SA can:

- Approve GPS override
- Reject GPS override

---

# Future Features

## WhatsApp Notification

Planned:

- Queue Registered
- Charging Started
- Charging Ending Soon
- Charging Completed

---

## Reports

Planned:

- Daily sessions
- Monthly sessions
- Average waiting time
- Charger utilization

---

# Success Criteria

- Queue updates in realtime
- Accurate ETA calculation
- Charging records stored permanently
- Simple user flow