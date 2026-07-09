# Project Context

•	Create a project called SurvAIve PH. 
•	The project must set into a futuristic, high-fidelity UI/UX components for a disaster response platform using a premium glassmorphism design system. 
•	The layout should resemble a professional role-based interfaces for a nationwide disaster intelligence and emergency response ecosystem. 
•	Use a clean dashboard composition with strong visual hierarchy, neon gradients, soft glows, floating translucent cards, rounded corners, layered depth, blurred glass panels, and mobile-app aesthetics.
•	Make it responsive so it works on mobile to
•	Break this into smaller steps.

Global UI/UX Style Requirements:
•	Modern glassmorphism with frosted translucent layers
•	Neon blue, cyan, violet, orange, and red accent gradients
•	Dark-mode futuristic interface
•	Soft ambient glows and luminous outlines
•	Consistent spacing, alignment, and grid systems
•	Depth through layered shadows and blur
•	Rounded 2xl corners throughout
•	Highly polished mobile + dashboard ecosystem presentation
•	Strong visual hierarchy emphasizing emergency workflows
•	Use realistic maps, charts, widgets, analytics cards, and emergency status indicators
•	Add subtle icons for offline-first, mesh networking, GPS-enabled, and secure communication

# Capstone Project: SurvAIve PH: An AI-Powered Mesh-Based Emergency Response and Victim Rescue System for Communities

Problem Solved: No cellular signal during typhoons and flooding delays rescue operations.

AI Integration:
•	AI predicts high-risk areas using weather and terrain data 
•	AI prioritizes rescue requests based on urgency 
•	AI chatbot works offline using mesh networking 

Novelty: Uses smartphones as peer-to-peer emergency nodes without internet.
Opportunities
•	reporting emergencies 
•	assisting DRRM offices 
•	GPS location reporting

Feature
•	Disaster alerts
•	GPS tracking
•	SOS messaging
•	AI integration
•	Offline communication
•	Mesh networking
•	Victim prioritization AI
•	Predictive analytics
•	Operates during signal outage
•	Smartphone-to-smartphone communication
•	Real-time situational intelligence

# STRONG NOVEL CONTRIBUTIONS
1. Offline-First Architecture
Most systems fail once:
•	cellular towers collapse 
•	internet connection disappears 
•	electricity is lost 
Your system can use:
•	Bluetooth mesh 
•	Wi-Fi Direct 
•	LoRa communication 
•	peer-to-peer networking 
This becomes highly relevant in island communities.

2. AI-Based Rescue Prioritization
Instead of “first report = first rescue,” AI can compute:
•	injury severity 
•	age vulnerability 
•	flood risk 
•	proximity to danger 
•	trapped status 
•	children/senior citizens presence 
Then the system automatically ranks rescue urgency.
This is a major innovation.

3. Intelligent Resource Allocation
AI can suggest:
•	which rescue team to deploy 
•	nearest available responder 
•	optimal evacuation route 
•	fuel-efficient deployment 
Very few local systems do this.

4. Signal-Less Community Communication
This is the strongest novelty.
Even without:
•	Smart 
•	Globe 
•	internet 
Phones can relay emergency messages between nearby devices until they reach responders.

This is called: Mesh Networking - This solves one of the biggest Philippine disaster problems.

5. AI Situation Awareness Dashboard
Instead of static maps:
•	AI analyzes incoming reports 
•	detects clustered emergencies 
•	predicts worsening zones 
•	visualizes high-risk areas 
This becomes a decision-support system for LGUs.

# SUGGESTED ADVANCED THESIS SCOPE
Mobile App Features
•	SOS emergency trigger 
•	offline messaging 
•	location beacon 
•	victim status reporting 
•	QR-based family identification 
•	emergency health profile 

AI Features
•	rescue priority scoring 
•	danger zone prediction 
•	evacuation recommendation 
•	responder allocation 
•	crowd clustering analysis 

Admin Dashboard
•	live map visualization 
•	incident heatmaps 
•	stranded victim count 
•	AI-generated rescue recommendations


# POSSIBLE CONCEPTUAL FRAMEWORK
INPUT
•	SOS reports 
•	GPS coordinates 
•	weather data 
•	sensor data 
•	victim profiles 

PROCESS
•	AI analysis 
•	prioritization algorithm 
•	mesh message routing 
•	predictive analytics 

OUTPUT
•	rescue recommendations 
•	optimized response 
•	real-time disaster intelligence 
•	faster rescue operations 

What Makes This Strong for MIT
This is no longer just:
•	mobile development 
•	web development 
It now includes:
•	Artificial Intelligence 
•	Distributed Systems 
•	Offline Networking 
•	GIS 
•	Disaster Informatics 
•	Humanitarian Technology 
•	Smart Communities 


# CORE IDEA: HYBRID OFFLINE-FIRST + MESH + DELAY-TOLERANT SYSTEM

1. Device-to-Device Mesh Networking (No Signal Needed)
Use technologies already available in smartphones:
•	Bluetooth Low Energy (BLE)
•	Wi-Fi Direct
Phones automatically form a mesh network, meaning:
•	Each phone acts as a mini relay tower
•	Messages “hop” from one phone to another until they reach a responder
Even without cell signal, nearby devices can still communicate.
Use case:
•	A victim sends an SOS → passes through nearby phones → reaches a rescue worker’s device

2. Offline-First Mobile App (Store & Forward)
The app should work even with zero connectivity:
•	Victim inputs:
o	Name (optional)
o	Status (injured, trapped, safe)
o	GPS location (last known if unavailable)
•	Data is stored locally on the phone
When the phone detects:
•	Another device → shares data via mesh
•	Temporary signal → uploads to server
This is called a Delay-Tolerant Network (DTN) approach.

3. Opportunistic GPS + Sensor Fusion
Even without internet:
•	GPS may still work intermittently
•	If GPS fails:
o	Use last known location
o	Use Bluetooth proximity clustering (group victims in same area)
o	Use manual tagging (“Barangay Hall”, “School Evac Center”)

6. Role-Based Mobile System (User vs Responder)
End Users (Mobile Only):
•	SOS button
•	Status updates
•	Auto-broadcast via mesh
•	Minimal UI (works offline)
Responders (Mobile + Laptop Dashboard):
•	Mobile: field data collection + sync
•	Laptop (Admin):
o	Map visualization
o	Cluster detection (hotspots of victims)
o	Resource allocation

7. Smart Prioritization Algorithm
Since data arrives in bursts:
•	Prioritize:
o	Serious injuries
o	children/elderly (if tagged)
o	High-density clusters
You can integrate:
•	Simple AI model for urgency scoring


# SurvAIve PH (UI/UX Components)

# ROLE 1 — Victim / Community User (Mobile PWA — Passive Node)
Victims have two entry modes that serve different purposes. Profiled login ties a person to their pre-registered constituent record, enabling the admin to confirm safety status against official barangay records. Guest mode allows anyone in distress to send an SOS without prior registration, but includes an anti-fake barrier to prevent false submissions. Both modes work offline after initial setup.

View: LandingAuth (Entry Gate)
•	Shown on first open or after logout
•	Two large equal-weight options: 
o	[Sign In with Profile] → goes to ProfileLogin
o	[Continue as Guest / Send SOS Anonymously] → goes to GuestChallenge
•	Small text: "What's the difference?" → expandable tooltip explaining both modes
•	No forced registration — the guest path is always available

View: ProfileLogin (Profiled Victim Path)
Purpose: Allow a community member to create or access their own profile using their contact number or Gmail account — no admin pre-registration required. The profile is self-submitted, linked to a verifiable identity credential, and used by the admin to confirm constituent safety status during disasters.

Step 1 — Choose Identity Credential
Two login/registration methods (either/or):
•	Mobile Number
o	Input field: Philippine format (+63 / 09XXXXXXXXX)
o	OTP sent via SMS to verify ownership
o	Enter 6-digit OTP → verified
•	Gmail / Google Account
o	Tap "Continue with Google" → Google OAuth popup
o	On success: email and display name pre-filled
Both methods confirm the person owns the credential — this is the anti-fake anchor for the profiled path. Once verified, the credential becomes the unique account identifier.

Step 2 — Complete Profile Form
Shown once after first-time credential verification. Pre-fills name from Google if Gmail login was used.
Personal Information
•	Full Name — Text input field (Required) 
•	Contact Number — Text input field (Automatically filled if the user logs in via SMS, but still editable) 
•	Gmail Address — Text input field (Automatically filled if the user logs in using Google, but still editable)

Location
(Cascading Dropdowns — offline list bundled within the app)
•	Province — Dropdown field that loads all provinces in the Philippines. 
•	Municipality / City — Dropdown field that automatically filters options based on the selected province. 
•	Barangay — Dropdown field that filters available options based on the selected municipality or city. 
•	Sitio / Purok — Open text field (Optional) for entering a more specific area or location.
The province → municipality → barangay dropdown list is bundled as a static JSON file inside the PWA (offline-capable). No internet required to navigate the location hierarchy.

Household Information
•	Household Members Count — Number input field used to indicate the total number of people living in the household. 
•	Vulnerabilities in Household — Multi-select checkbox field where users can identify vulnerable household members, such as: 
o	Elderly (60+) 
o	Person with Disability (PWD) 
o	Infant (0–2 years old) 
o	Pregnant 
o	None 
•	Known Medical Conditions — Optional text area for listing existing medical conditions (e.g., diabetes, hypertension).

Emergency Contact
•	Emergency Contact Name — Text input field (Required). 
•	Relationship — Dropdown field where the user can select the relationship to the emergency contact, such as: 
o	Parent 
o	Spouse 
o	Sibling 
o	Child 
o	Neighbor 
o	Other 
•	Emergency Contact Number — Text input field (Required).

Step 3 — Profile Confirmation
•	Summary card showing all entered data
•	"Edit" link per section
•	[Confirm & Save Profile] button
•	Profile stored locally in IndexedDB + synced to server when online
•	Admin dashboard will show this profile in ConstituentRegistry under their barangay

Returning User Login
After profile is created, subsequent logins are frictionless:
•	SMS login: enter number → receive OTP → auto-loads profile
•	Gmail login: tap "Continue with Google" → auto-loads profile
•	Offline returning login: If profile was previously cached in IndexedDB, user can bypass OTP and access their profile with a PIN (4-digit, set during registration) — ensures access even with no signal

Profile data available to Admin (read-only):
•	Full name, contact number / Gmail
•	Province → Municipality → Barangay → Sitio/Purok
•	Household members count + vulnerability flags
•	Known medical conditions
•	Emergency contact name + number
•	Account status: Active / SOS Sent / Rescued / Unknown

View: GuestChallenge (Guest / Anonymous Path)
Purpose: Allow unregistered victims to send SOS while preventing spam/fake submissions
•	Step 1 — Location Confirmation:
o	App requests GPS access; shows current detected location
o	User confirms: "Yes, I am in [Barangay X]" or manually selects nearest barangay
o	If GPS unavailable: manual barangay/sitio selection from dropdown (offline list)
•	Step 2 — Anti-Fake Challenge (choose one, shown randomly):
o	Simple CAPTCHA — tap the correct emergency icon from a set
o	Human confirmation phrase — type a short prompted phrase (e.g., "I need help")
o	Shake confirmation — shake device 3× within 5 seconds to confirm physical presence
•	Step 3 — Disclaimer Acknowledgment:
o	"Submitting a false emergency report is a violation of [RA 10173 / local ordinance]. This report is logged and traceable."
o	[I Understand — Proceed] button
•	On completion → navigates to HomeScreen with mode: "guest" flag set
•	Guest SOS reports are tagged: isVerified: false, trustScore: LOW in the database

View: HomeScreen
•	Giant SOS button (3-second long press to trigger)
•	Profile badge (top right): 
o	Profiled: shows name + green "Verified" chip
o	Guest: shows "Anonymous" + amber "Unverified" chip
•	GPS status indicator: "GPS Active" / "Last Known Location"
•	Mesh connectivity: "Offline Mode" / "Mesh Connected (N devices)"
•	Quick-tap status: [Injured] [Trapped] [Safe]
•	Battery-aware minimal UI with dark mode default

View: SOSReport
•	Auto-fills fields from profile (if profiled mode): 
o	Name, barangay, household size, medical vulnerabilities
•	Guest mode: all fields blank, name is optional
•	Shared fields: 
o	Status (dropdown): Injured / Trapped / Missing / Safe
o	Number of people with you
o	Notes (free text)
o	Auto-captured: GPS / last-known location, timestamp
•	Trust tag auto-attached: 
o	Profiled → isVerified: true, trustScore: HIGH
o	Guest → isVerified: false, trustScore: LOW
•	Submit → stores in IndexedDB → auto-broadcast via mesh
•	Offline-safe: queued for sync when signal returns

View: MeshStatus
•	List of nearby connected devices (anonymized device IDs)
•	Signal strength per device
•	Messages forwarded count
•	Last sync timestamp

View: LocalMap
•	Leaflet map with offline tile cache
•	Pins color-coded: Red (Critical), Yellow (Moderate), Green (Safe)
•	Clustered markers for dense areas
•	No internet required

View: Settings
•	Emergency contact entry
•	Auto-SOS: shake trigger / volume button
•	Battery saver mode toggle
•	Account info: shows current mode (Profiled / Guest) + option to re-authenticate
•	Data privacy notice

Profile-Based Safety Verification Logic (Admin ↔ Victim)
This is a key civic feature: admins can use SurvAIve PH as a digital constituent safety registry, not just a rescue tool.
Pre-disaster (community preparedness phase):
  Residents self-register via PWA using their contact number or Gmail
  Verified via OTP or Google OAuth
  Profile includes: name, full address, household vulnerabilities
  Admin sees all registrations in ConstituentRegistry per barangay

During disaster:
  Profiled victim logs in (OTP or Google) → SOS tagged with verified credential
  Admin sees: "Maria Santos (+63912XXXXXXX) — Brgy. Libertad, Purok 3 — TRAPPED — Verified"
  Unregistered victims appear as guest reports with no identity link

Post-event:
  Admin runs SafetyVerification view:
  → Constituents who sent SOS: status known (Injured / Safe / Rescued)
  → Registered constituents with no report: flagged as "Status Unknown"
  → Admin can manually mark "Accounted For" after phone or in-person check
  → Enables systematic welfare check of entire registered population

# ROLE 2 — Field Responder (Mobile PWA — Active Mesh Node)
The Responder's device serves a dual purpose: it is both a rescue tool and an active mesh relay node that extends coverage deeper into signal-dead zones. Every Responder phone passively forwards mesh traffic from victims it cannot yet reach.

View: ResponderHome
•	Active mission status: "On Duty" / "Standby"
•	Mesh Node Indicator: "Relaying — N messages forwarded | M peers connected"
•	Assigned victim count with critical alerts badge
•	Quick-access buttons: [View Queue] [Open Map] [Sync Now]
•	Battery + GPS status always visible

View: VictimQueue
•	AI-prioritized list of victims assigned to this responder
•	Each card shows: 
o	Priority badge: CRITICAL / HIGH / MODERATE
o	Victim status, number of people, last known GPS
o	Distance estimate (if GPS available)
o	Time since report
•	Tap card → opens RescueDetail
•	Offline-capable: list cached from last sync

View: RescueDetail
•	Full victim profile: name, status, notes, GPS pin
•	Contextual action buttons: 
o	[En Route] → updates status, broadcasts to mesh
o	[On Scene] → starts rescue timer
o	[Rescued] → confirms, triggers sync to server/admin
o	[Cannot Reach] → flags for reassignment
•	Field notes input (synced when signal returns)
•	One-tap victim location opens in FieldMap

View: FieldMap
•	Offline Leaflet map scoped to responder's assigned zone
•	Shows: 
o	Assigned victims (numbered by priority)
o	Responder's own GPS position
o	Suggested route hint (pre-computed, cached)
o	Nearby responder devices (if mesh-visible)
•	Color-coded pins matching priority levels

View: MeshRelay
•	Visual display of responder device as a network node
•	Active relay stats: 
o	"Forwarding messages from N devices"
o	"Connected peers: [device IDs anonymized]"
o	"Data relayed: X KB"
o	"Last upstream sync: T mins ago"
•	Toggle: "Active Relay Mode" (keeps BLE/WebRTC scanning alive)
•	Battery cost warning when relay mode is on

View: ResponderSettings
•	Team ID / unit name
•	Assigned zone / barangay
•	Offline mode force-toggle
•	Auto-relay toggle (background mesh forwarding)
•	Sync history log

# ROLE 3 — Admin / DRRM Officer / LGU Mayor — Municipality Level (Full PWA Dashboard)
The Admin operates at the municipality level. They manage their own barangays, constituents, responders, and incidents. All data generated at this level is also pushed upward to the Super Admin (DOST) in read-only aggregated form.

View: CommandCenter
•	Full-screen interactive Leaflet map (center)
•	Victim pins + heatmap overlay — differentiated by: Verified (solid pin) / Guest (outlined pin)
•	Sidebar stats: Total Victims | Critical | Rescued | Active Nodes | Unverified Reports
•	Real-time sync status
•	Quick link to SafetyVerification

View: VictimTable
•	Columns: ID, Name, Status, Barangay, Timestamp, AI Priority Score, Verified (✓/Guest)
•	Filters: Critical Only, By Barangay, By Status, Verified Only, Guest Only
•	Actions: Assign Rescue Team, Mark Rescued, View on Map, Flag as Suspicious
•	Suspicious flagging: demotes priority score, marks report for review

View: ConstituentRegistry
Purpose: View and manage all self-registered constituent profiles within the admin's municipality. Residents register themselves via the Victim PWA; this panel is the admin's read-only window into that registry, with tools for verification and welfare tracking.
•	Search & filter registered residents by: 
o	Barangay, Municipality, Province
o	Vulnerability group (Elderly, PWD, Infant, Pregnant)
o	Account status: Active / SOS Sent / Rescued / Status Unknown
•	Constituent record view: name, contact (phone/Gmail), full address, household size, vulnerabilities, emergency contact
•	Bulk export: Download registry as CSV or PDF per barangay (for offline welfare check sheets)
•	Manual entry fallback: Admin can still manually add constituents who do not have smartphones (e.g., elderly with no device) — these get a system-generated token linked to their contact number or next-of-kin's account
•	Verification badge: Profiles verified via OTP/Gmail show a ✓ Verified badge; manually added records show "Admin-Entered"

View: SafetyVerification
Purpose: Cross-check who has reported in vs. who hasn't — identify the missing
•	Side-by-side panel: 
o	Left: Constituents who sent SOS (profiled, status known)
o	Right: Registered constituents with NO report (status unknown — may need welfare check)
•	Filters: By barangay, by vulnerability group (elderly, PWD, children)
•	Action: "Mark as Accounted For" (e.g., admin verbally confirmed safety)
•	Export: welfare check list for field teams
•	Summary card: "237 of 850 registered residents accounted for"

View: Analytics
•	Pie chart: victim status distribution
•	Bar graph: reports over time (Verified vs Guest breakdown)
•	AI priority score histogram
•	Predicted high-risk zone map overlay
•	Verified-to-guest ratio (spam indicator metric)

View: Responders
•	Active rescue teams on map
•	Task assignment: "Team A → Zone 3"
•	Optional offline-synced messaging
•	Responder node coverage map (which zones have active mesh relay)


# ROLE 4 — Super Admin / DOST — Provincial Level (Full PWA Dashboard)
The Super Admin operates at the provincial level. They have read-only access to aggregated data from all municipalities under their jurisdiction. They cannot assign responders or edit victim records — their role is situational oversight, resource escalation coordination, and inter-municipality intelligence.

View: ProvincialDashboard
•	Full-screen Leaflet map showing all municipalities in the province
•	Each municipality rendered as a zone overlay, color-coded by severity: 
o	Red: active critical incidents
o	Amber: moderate incidents
o	Green: situation stable / no active SOS
o	Gray: no data / offline
•	Summary stats bar: Total Incidents (Province-wide) | Critical | Rescued | Municipalities Reporting
•	Click a municipality zone → opens MunicipalityDetail drawer

View: MunicipalityList
•	Card grid — one card per municipality
•	Each card shows: 
o	Municipality name + LGU admin contact
o	Total SOS count | Critical count | Rescued count
o	Verified vs Guest ratio
o	Last sync timestamp
o	Status badge: ACTIVE EMERGENCY / MONITORING / STABLE
•	Sort by: most critical, most recent activity, name

View: MunicipalityDetail (Drawer / Modal)
•	Triggered by clicking a municipality card or map zone
•	Drills into that municipality's aggregated data: 
o	Read-only victim table (no actions available)
o	Barangay-level breakdown
o	Active responder count
o	AI-generated danger zone overlay for that area
•	"Escalate to National" button — flags municipality for NDRRMC attention (optional integration)

View: ProvincialAnalytics
•	Cross-municipality comparison charts: 
o	Bar chart: incident count per municipality
o	Line graph: SOS report trends over time, per municipality
o	Heatmap: province-wide danger intensity map
•	Exportable report (PDF) for DOST / NDRRMC briefing
•	AI surge detection: highlights if any municipality shows abnormal incident spike

View: EscalationFeed
•	Chronological feed of critical incidents escalated by municipal admins
•	Each entry: municipality, incident summary, timestamp, escalation reason
•	Super Admin can add response notes (visible to that municipal admin)
•	Filter: unacknowledged escalations

Data Hierarchy & Access Control Summary
•	Victim (Profiled) 
o	Scope: Access limited to their own SOS report. 
o	Can Edit: Their own report only. 
o	Can View: Their personal rescue or incident status. 
•	Victim (Guest) 
o	Scope: Access limited to their own SOS report. 
o	Can Edit: Their own report only. 
o	Can View: Their personal rescue or incident status. 
•	Responder 
o	Scope: Assigned operational or rescue zone. 
o	Can Edit: Rescue-related actions and updates. 
o	Can View: Assigned victims within their area of responsibility. 
•	Admin / DRRM 
o	Scope: Municipality-level access and management. 
o	Can Edit: All municipal data and incident records. 
o	Can View: Municipal incidents and related reports. 
•	Super Admin / DOST 
o	Scope: Province-wide access. 
o	Can Edit: None (read-only access). 
o	Can View: All municipalities and their corresponding data.