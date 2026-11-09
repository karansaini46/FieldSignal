import {
  PrismaClient,
  UserRole,
  SiteStatus,
  AssetType,
  AssetStatus,
  IncidentStatus,
  IncidentPriority,
  FaultCategory,
  IncidentEventType,
  ClarificationStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting FieldSignal database seed...");

  // 1. Clean existing records in referential order
  await prisma.clarification.deleteMany();
  await prisma.incidentEvent.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.audioRecording.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.user.deleteMany();
  await prisma.site.deleteMany();
  await prisma.organization.deleteMany();

  // ---------------------------------------------------------------------------
  // 2. Organization: Sunrise Solar Operations
  // ---------------------------------------------------------------------------
  const organization = await prisma.organization.create({
    data: {
      name: "Sunrise Solar Operations",
      code: "SUNRISE-SOLAR",
    },
  });
  console.log(`✅ Created Organization: ${organization.name} (${organization.code})`);

  // ---------------------------------------------------------------------------
  // 3. Sites (Two realistic solar facilities)
  // ---------------------------------------------------------------------------
  const siteBhadla = await prisma.site.create({
    data: {
      organizationId: organization.id,
      name: "Bhadla Solar Park - Sector IV",
      code: "SUN-BHA-04",
      capacityMw: 50.0,
      location: "Phalodi District, Rajasthan, India",
      latitude: 27.5385,
      longitude: 71.9172,
      timezone: "Asia/Kolkata",
      status: SiteStatus.OPERATIONAL,
    },
  });

  const sitePavagada = await prisma.site.create({
    data: {
      organizationId: organization.id,
      name: "Pavagada Solar Park - Block B",
      code: "SUN-PAV-02",
      capacityMw: 40.0,
      location: "Tumakuru District, Karnataka, India",
      latitude: 14.1025,
      longitude: 77.2785,
      timezone: "Asia/Kolkata",
      status: SiteStatus.OPERATIONAL,
    },
  });
  console.log(`✅ Created Sites: ${siteBhadla.name} (50 MW), ${sitePavagada.name} (40 MW)`);

  // ---------------------------------------------------------------------------
  // 4. Users (Technicians, Site Supervisors, Plant Managers)
  // ---------------------------------------------------------------------------
  // Default secure password hash for seeded accounts ("password123")
  const passwordHash = bcrypt.hashSync("password123", 10);

  await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Pooja Sharma",
      phone: "+919876500000",
      email: "pooja.sharma@sunrisesolar.com",
      role: UserRole.ADMIN,
      passwordHash,
    },
  });

  const supervisorVikram = await prisma.user.create({
    data: {
      organizationId: organization.id,
      siteId: siteBhadla.id,
      name: "Vikramaditya Rathore",
      phone: "+919876500001",
      email: "vikram.rathore@sunrisesolar.com",
      role: UserRole.SUPERVISOR,
      passwordHash,
    },
  });

  const techRajesh = await prisma.user.create({
    data: {
      organizationId: organization.id,
      siteId: siteBhadla.id,
      name: "Rajesh Meena",
      phone: "+919876500002",
      email: "rajesh.meena@sunrisesolar.com",
      role: UserRole.TECHNICIAN,
      passwordHash,
    },
  });

  const techSuresh = await prisma.user.create({
    data: {
      organizationId: organization.id,
      siteId: siteBhadla.id,
      name: "Suresh Gurjar",
      phone: "+919876500003",
      email: "suresh.gurjar@sunrisesolar.com",
      role: UserRole.TECHNICIAN,
      passwordHash,
    },
  });

  const supervisorAnand = await prisma.user.create({
    data: {
      organizationId: organization.id,
      siteId: sitePavagada.id,
      name: "Anand Gowda",
      phone: "+919876500004",
      email: "anand.gowda@sunrisesolar.com",
      role: UserRole.SUPERVISOR,
      passwordHash,
    },
  });

  const techPraveen = await prisma.user.create({
    data: {
      organizationId: organization.id,
      siteId: sitePavagada.id,
      name: "Praveen Kumar",
      phone: "+919876500005",
      email: "praveen.kumar@sunrisesolar.com",
      role: UserRole.TECHNICIAN,
      passwordHash,
    },
  });
  console.log(`✅ Created 6 Users (1 Plant Manager, 2 Supervisors, 3 Field Technicians)`);

  // ---------------------------------------------------------------------------
  // 5. Assets (Hierarchical solar plant infrastructure — no fake metrics)
  // ---------------------------------------------------------------------------

  // --- SITE 1: Bhadla Solar Park Assets ---
  await prisma.asset.create({
    data: {
      siteId: siteBhadla.id,
      assetTag: "TR-01",
      name: "Main Power Transformer 1 (33kV/132kV)",
      assetType: AssetType.TRANSFORMER,
      block: "Substation-01",
      status: AssetStatus.OPERATIONAL,
      manufacturer: "BHEL",
      model: "ONAN/ONAF 50MVA",
      serialNumber: "BHEL-2022-TR-942",
      metadata: { ratedMva: 50, primaryKv: 33, secondaryKv: 132 },
    },
  });

  await prisma.asset.create({
    data: {
      siteId: siteBhadla.id,
      assetTag: "HT-01",
      name: "33kV HT Vacuum Circuit Breaker",
      assetType: AssetType.OTHER,
      block: "Substation-01",
      status: AssetStatus.OPERATIONAL,
      manufacturer: "ABB",
      model: "UniGear ZS1",
      metadata: { ratedCurrentA: 1250, breakingCapacityKa: 25 },
    },
  });

  await prisma.asset.create({
    data: {
      siteId: siteBhadla.id,
      assetTag: "WMS-01",
      name: "Weather Monitoring Station North",
      assetType: AssetType.OTHER,
      block: "Control-Room-Yard",
      status: AssetStatus.OPERATIONAL,
      manufacturer: "Campbell Scientific",
      model: "CR1000X Solar Station",
      metadata: { sensors: ["GHI Pyranometer", "POA Pyranometer", "Module Temp", "Anemometer"] },
    },
  });

  // Inverter Station 1 (Parent asset)
  const invSt01 = await prisma.asset.create({
    data: {
      siteId: siteBhadla.id,
      assetTag: "INV-ST-01",
      name: "Inverter Station 01 Skid",
      assetType: AssetType.OTHER,
      block: "Block-A",
      status: AssetStatus.OPERATIONAL,
      manufacturer: "SMA Solar",
      model: "MV Power Station 5000",
    },
  });

  // Central Inverter 1 under Inverter Station 1
  const inv01 = await prisma.asset.create({
    data: {
      siteId: siteBhadla.id,
      parentAssetId: invSt01.id,
      assetTag: "INV-01",
      name: "Central Inverter 1 (SMA 2.5MW)",
      assetType: AssetType.INVERTER,
      block: "Block-A",
      status: AssetStatus.DEGRADED,
      manufacturer: "SMA Solar",
      model: "Sunny Central 2500-EV",
      serialNumber: "SMA-SC2500-0194",
      ratedCapacityKw: 2500.0,
      metadata: { maxDcVoltageV: 1500, mpptChannels: 1, coolingType: "Forced Air Blower" },
    },
  });

  // String Combiner Boxes under Inverter 1
  const scb01A = await prisma.asset.create({
    data: {
      siteId: siteBhadla.id,
      parentAssetId: inv01.id,
      assetTag: "SCB-01-A",
      name: "String Combiner Box 1A (24-Channel)",
      assetType: AssetType.COMBINER_BOX,
      block: "Block-A",
      row: "Row 01",
      status: AssetStatus.OPERATIONAL,
      manufacturer: "Hensel",
      model: "Enystar 1500V DC",
      metadata: { channels: 24, fuseRatingA: 15 },
    },
  });

  await prisma.asset.create({
    data: {
      siteId: siteBhadla.id,
      parentAssetId: inv01.id,
      assetTag: "SCB-01-B",
      name: "String Combiner Box 1B (24-Channel)",
      assetType: AssetType.COMBINER_BOX,
      block: "Block-A",
      row: "Row 02",
      status: AssetStatus.OPERATIONAL,
      manufacturer: "Hensel",
      model: "Enystar 1500V DC",
      metadata: { channels: 24, fuseRatingA: 15 },
    },
  });

  // Solar Module Strings under Combiner Box
  await prisma.asset.create({
    data: {
      siteId: siteBhadla.id,
      parentAssetId: scb01A.id,
      assetTag: "MOD-STR-01",
      name: "Solar PV Module String 01 (540W Mono PERC)",
      assetType: AssetType.SOLAR_MODULE,
      block: "Block-A",
      row: "Row 01",
      status: AssetStatus.OPERATIONAL,
      manufacturer: "LONGi Solar",
      model: "Hi-MO 5 LR5-72HBD-540M",
      serialNumber: "LON-540-08129",
      ratedCapacityKw: 15.1,
      metadata: { modulesPerString: 28, cellType: "Bifacial Mono PERC" },
    },
  });

  // Tracker Motor in Block-A
  await prisma.asset.create({
    data: {
      siteId: siteBhadla.id,
      assetTag: "TRK-M-01",
      name: "Single-Axis Slew Drive Tracker Motor 01",
      assetType: AssetType.OTHER,
      block: "Block-A",
      row: "Row 01-05",
      status: AssetStatus.OPERATIONAL,
      manufacturer: "Array Technologies",
      model: "DuraTrack HZ v3 Drive",
      metadata: { driveType: "DC Slew Drive", trackingRangeDeg: 60 },
    },
  });

  // Central Inverter 3 in Block-B
  const inv03 = await prisma.asset.create({
    data: {
      siteId: siteBhadla.id,
      assetTag: "INV-03",
      name: "Central Inverter 3 (ABB 2MW)",
      assetType: AssetType.INVERTER,
      block: "Block-B",
      status: AssetStatus.FAULTED,
      manufacturer: "ABB",
      model: "PVS980-58 2000kVA",
      serialNumber: "ABB-PVS980-8841",
      ratedCapacityKw: 2000.0,
      metadata: { maxDcVoltageV: 1500, coolingType: "Phase Change Heat Pipe" },
    },
  });

  // --- SITE 2: Pavagada Solar Park Assets ---
  await prisma.asset.create({
    data: {
      siteId: sitePavagada.id,
      assetTag: "TR-02",
      name: "Step-Up Transformer 2 (33kV/66kV)",
      assetType: AssetType.TRANSFORMER,
      block: "Substation-02",
      status: AssetStatus.OPERATIONAL,
      manufacturer: "Siemens",
      model: "GEAFOL Cast Resin 40MVA",
      metadata: { ratedMva: 40, primaryKv: 33, secondaryKv: 66 },
    },
  });

  await prisma.asset.create({
    data: {
      siteId: sitePavagada.id,
      assetTag: "STR-INV-01",
      name: "String Inverter 01 (Sungrow 250kW)",
      assetType: AssetType.INVERTER,
      block: "Block-01",
      row: "Row 01",
      status: AssetStatus.OPERATIONAL,
      manufacturer: "Sungrow",
      model: "SG250HX",
      serialNumber: "SG-250HX-39120",
      ratedCapacityKw: 250.0,
      metadata: { mpptInputs: 12, maxEfficiencyPercent: 99.0 },
    },
  });

  const trkPavagada01 = await prisma.asset.create({
    data: {
      siteId: sitePavagada.id,
      assetTag: "TRK-M-PV-01",
      name: "Horizon Single-Axis Tracker Drive 01",
      assetType: AssetType.OTHER,
      block: "Block-01",
      row: "Row 01-08",
      status: AssetStatus.OPERATIONAL,
      manufacturer: "Nextracker",
      model: "NX Horizon Smart Slew Drive",
      metadata: { trackingAngleDeg: 60, motorVoltageVdc: 24 },
    },
  });
  console.log(`✅ Created 11 realistic synthetic solar assets across both sites`);

  // ---------------------------------------------------------------------------
  // 6. Audio Recordings (Immutable voice transcript snapshots)
  // ---------------------------------------------------------------------------
  const audioBhadla01 = await prisma.audioRecording.create({
    data: {
      userId: techRajesh.id,
      siteId: siteBhadla.id,
      filePath: "/uploads/audio/seed/bhadla_inv01_trip.webm",
      mimeType: "audio/webm;codecs=opus",
      fileSizeBytes: 148200,
      durationSeconds: 14.8,
      originalTranscript:
        "Bhai Block A me Inverter 1 subah se E-14 over-temperature error pe trip ho raha hai. Heat sink ka temp 82 degree chala gaya hai aur cooling fan nahi chal raha.",
      language: "hi-IN",
      confidence: 0.94,
      processingLatencyMs: 1420,
      metadata: { codec: "opus", sampleRate: 48000, bitRateKbps: 16 },
    },
  });

  const audioPavagada01 = await prisma.audioRecording.create({
    data: {
      userId: techPraveen.id,
      siteId: sitePavagada.id,
      filePath: "/uploads/audio/seed/pavagada_tracker_jam.webm",
      mimeType: "audio/webm;codecs=opus",
      fileSizeBytes: 112000,
      durationSeconds: 11.2,
      originalTranscript:
        "Block 1 Row 1 ka tracker motor jam ho gaya hai. Slew drive mechanical sound kar raha hai aur panels subah ke angle pe atke hue hain.",
      language: "hinglish",
      confidence: 0.91,
      processingLatencyMs: 1280,
      metadata: { codec: "opus", sampleRate: 48000, bitRateKbps: 16 },
    },
  });
  console.log(`✅ Created 2 AudioRecordings with immutable transcripts`);

  // ---------------------------------------------------------------------------
  // 7. Incidents, Events & Clarifications
  // ---------------------------------------------------------------------------

  // --- Incident 1: Over-Temperature Trip (Linked with Audio & Events) ---
  const incident01 = await prisma.incident.create({
    data: {
      ticketNumber: "INC-2026-0001",
      siteId: siteBhadla.id,
      assetId: inv01.id,
      reportedByUserId: techRajesh.id,
      assignedToUserId: techSuresh.id,
      audioRecordingId: audioBhadla01.id,
      status: IncidentStatus.IN_PROGRESS,
      priority: IncidentPriority.HIGH,
      faultCategory: FaultCategory.OVER_TEMPERATURE,
      title: "Inverter 1 E-14 Heat Sink Over-Temperature Trip",
      description:
        "Technician reported Inverter 1 in Block-A tripping intermittently on error code E-14. External heat sink temperature reading over 82°C. Blower fan motor unresponsive.",
      symptoms:
        "Blower fan stopped, heat sink temperature exceeded safe thermal threshold, inverter tripped on E-14",
      errorCode: "E-14",
      originalTranscript: audioBhadla01.originalTranscript,
      detectedLanguage: "hi-IN",
      isRepeatFault: true,
      repeatCount30d: 2,
      confirmedAt: new Date(Date.now() - 3600000 * 2),
    },
  });

  // Incident 1 Events
  await prisma.incidentEvent.createMany({
    data: [
      {
        incidentId: incident01.id,
        userId: techRajesh.id,
        eventType: IncidentEventType.CONFIRMATION,
        fromStatus: IncidentStatus.DRAFT,
        toStatus: IncidentStatus.SUBMITTED,
        title: "Technician Confirmed Voice Draft",
        description:
          "Draft created from voice recording reviewed and confirmed by technician Rajesh Meena.",
      },
      {
        incidentId: incident01.id,
        userId: supervisorVikram.id,
        eventType: IncidentEventType.ASSIGNMENT,
        fromStatus: IncidentStatus.SUBMITTED,
        toStatus: IncidentStatus.ACKNOWLEDGED,
        title: "Assigned to Field Technician",
        description:
          "Assigned to Suresh Gurjar for blower motor replacement and thermal paste inspection.",
      },
      {
        incidentId: incident01.id,
        userId: techSuresh.id,
        eventType: IncidentEventType.STATUS_CHANGE,
        fromStatus: IncidentStatus.ACKNOWLEDGED,
        toStatus: IncidentStatus.IN_PROGRESS,
        title: "Work Commenced On-Site",
        description: "Suresh arrived at Inverter Station 01 with spare fan assembly.",
      },
    ],
  });

  // --- Incident 2: Critical Smoke / Arc with Pending Clarification (No Audio, manual/quick report) ---
  const incident02 = await prisma.incident.create({
    data: {
      ticketNumber: "INC-2026-0002",
      siteId: siteBhadla.id,
      assetId: inv03.id,
      reportedByUserId: techRajesh.id,
      status: IncidentStatus.SUBMITTED,
      priority: IncidentPriority.CRITICAL,
      faultCategory: FaultCategory.DC_ARC_FIRE,
      title: "DC Isolator Smoke & Burnt Insulation at Inverter 3",
      description:
        "Visible smoke and strong burning smell detected near DC switchgear enclosure of Inverter 3 in Block-B. Inverter isolated pending urgent safety inspection.",
      symptoms: "Smoke discharge, acrid burnt electrical smell, DC circuit disconnect tripped",
      missingFields: ["immediateActionTaken", "fireExtinguisherUsed"],
      isRepeatFault: false,
      confirmedAt: new Date(),
    },
  });

  // Incident 2 Clarification (associated with missing safety fields)
  await prisma.clarification.create({
    data: {
      incidentId: incident02.id,
      requestedByUserId: supervisorVikram.id,
      question:
        "Aapne Inverter 3 pe smoke report kiya hai. Kya DC isolator manual trip kiya gaya hai aur fire extinguisher use hua? Kripya status confirm karein.",
      missingField: "immediateActionTaken",
      status: ClarificationStatus.PENDING,
    },
  });

  // --- Incident 3: Tracker Slew Drive Jammed & Resolved ---
  const incident03 = await prisma.incident.create({
    data: {
      ticketNumber: "INC-2026-0003",
      siteId: sitePavagada.id,
      assetId: trkPavagada01.id,
      reportedByUserId: techPraveen.id,
      assignedToUserId: techPraveen.id,
      audioRecordingId: audioPavagada01.id,
      status: IncidentStatus.RESOLVED,
      priority: IncidentPriority.MEDIUM,
      faultCategory: FaultCategory.TRACKER_FAILURE,
      title: "Row 1-8 Single-Axis Tracker Slew Drive Jammed",
      description:
        "Tracker drive in Block-01 stuck at early morning tilt angle (+45°). Slew gearbox stalled with mechanical clicking noise.",
      symptoms:
        "Mechanical clicking in gearbox, inclinometer position unchanged during Sun tracking",
      originalTranscript: audioPavagada01.originalTranscript,
      detectedLanguage: "hinglish",
      confirmedAt: new Date(Date.now() - 3600000 * 8),
      resolvedAt: new Date(Date.now() - 3600000 * 2),
      resolutionNotes:
        "Debris and sand accumulated inside slew drive gear teeth cleared. Gearbox flushed with EP2 grease. Recalibrated inclinometer sensor zero-point. Tracker returned to auto-tracking mode successfully.",
    },
  });

  await prisma.incidentEvent.createMany({
    data: [
      {
        incidentId: incident03.id,
        userId: techPraveen.id,
        eventType: IncidentEventType.CONFIRMATION,
        fromStatus: IncidentStatus.DRAFT,
        toStatus: IncidentStatus.SUBMITTED,
        title: "Voice Report Confirmed",
      },
      {
        incidentId: incident03.id,
        userId: supervisorAnand.id,
        eventType: IncidentEventType.ASSIGNMENT,
        fromStatus: IncidentStatus.SUBMITTED,
        toStatus: IncidentStatus.IN_PROGRESS,
        title: "Direct Assignment & Work Start",
      },
      {
        incidentId: incident03.id,
        userId: techPraveen.id,
        eventType: IncidentEventType.STATUS_CHANGE,
        fromStatus: IncidentStatus.IN_PROGRESS,
        toStatus: IncidentStatus.RESOLVED,
        title: "Mechanical Repair Completed",
        description: "Gearbox flushed and inclinometer recalibrated.",
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // 8. Secondary Organization: Apex Clean Energy (For multi-tenant isolation testing)
  // ---------------------------------------------------------------------------
  const orgApex = await prisma.organization.create({
    data: {
      name: "Apex Clean Energy",
      code: "APEX-SOLAR",
    },
  });

  const siteApex = await prisma.site.create({
    data: {
      organizationId: orgApex.id,
      name: "Rewa Ultra Mega Solar - Unit 1",
      code: "APEX-REW-01",
      capacityMw: 25.0,
      location: "Rewa District, Madhya Pradesh, India",
    },
  });

  const userApexTech = await prisma.user.create({
    data: {
      organizationId: orgApex.id,
      siteId: siteApex.id,
      name: "Amit Patel",
      phone: "+919876599999",
      email: "amit.patel@apexcleanenergy.com",
      role: UserRole.TECHNICIAN,
      passwordHash,
    },
  });

  const assetApex = await prisma.asset.create({
    data: {
      siteId: siteApex.id,
      assetTag: "INV-APEX-01",
      name: "Central Inverter Rewa 01",
      assetType: AssetType.INVERTER,
      block: "Block-Rewa-1",
    },
  });

  await prisma.incident.create({
    data: {
      ticketNumber: "INC-APEX-0001",
      siteId: siteApex.id,
      assetId: assetApex.id,
      reportedByUserId: userApexTech.id,
      status: IncidentStatus.SUBMITTED,
      priority: IncidentPriority.MEDIUM,
      faultCategory: FaultCategory.FUSE_BLOWN,
      title: "Apex Solar Fuse Blown In Rewa Unit 1",
      description: "Blown DC string fuse detected during routine inspection.",
    },
  });

  console.log(
    `✅ Created 3 realistic Incidents for Sunrise Solar + 1 isolated Incident for Apex Energy`
  );
  console.log("🌟 Seed completed successfully with zero fake production metrics!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
