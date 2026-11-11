import { FlowTemplate } from "@/types/flows";

export const PREBUILT_FLOW_TEMPLATES: FlowTemplate[] = [
  // 1. Astrology Consultation & Horary Intake Flow
  {
    id: "template-astrology-intake",
    name: "Astrology Consultation & Horary Intake",
    description: "Captures date of birth, time, and consultation topic with business-hours check and astrologer assignment.",
    flow_type: "intake",
    businessCategory: "astrology",
    nodes: [
      {
        id: "node-1",
        type: "trigger",
        position: { x: 80, y: 120 },
        data: {
          title: "Inbound Keyword Trigger",
          description: "Listens for Astrology consultation triggers",
          config: {
            triggerType: "keyword",
            keywords: ["jathagam", "horoscope", "ஜாதகம்", "consultation", "kp astrology"],
            matchType: "contains",
          },
        },
      },
      {
        id: "node-2",
        type: "message",
        position: { x: 380, y: 120 },
        data: {
          title: "Welcome & Details Request",
          description: "Sends polite Tamil/English greeting requesting birth chart details",
          config: {
            messageText:
              "Vanakkam! 🙏 Welcome to Gokul's Astrological Insights.\n\nTo prepare your KP Horoscope Analysis, please share:\n1. Full Name\n2. Date of Birth (DD-MM-YYYY)\n3. Exact Time of Birth (AM/PM)\n4. Place of Birth (City/District)\n5. Specific Query (Marriage / Career / Health)",
          },
        },
      },
      {
        id: "node-3",
        type: "condition",
        position: { x: 680, y: 120 },
        data: {
          title: "Business Hours Check",
          description: "Evaluates if enquiry arrived within 9 AM - 6 PM IST",
          config: {
            conditionType: "business_hours",
            operator: "in_hours",
          },
        },
      },
      {
        id: "node-4",
        type: "action",
        position: { x: 980, y: 40 },
        data: {
          title: "Assign to Astrologer Gokul",
          description: "Routes consultation case directly to primary astrologer",
          config: {
            actionType: "assign_agent",
            agentName: "Gokul (Lead Astrologer)",
            crmStage: "qualified",
          },
        },
      },
      {
        id: "node-5",
        type: "message",
        position: { x: 980, y: 220 },
        data: {
          title: "After-Hours Auto-Acknowledgement",
          description: "Informs client that consultation review starts next morning",
          config: {
            messageText:
              "Thank you for submitting your details. Our astrologer will review your planetary positions tomorrow at 9:30 AM and reach out with appointment slots. Subham! ✨",
          },
        },
      },
    ],
    edges: [
      { id: "e1-2", source: "node-1", target: "node-2" },
      { id: "e2-3", source: "node-2", target: "node-3" },
      { id: "e3-4", source: "node-3", sourceHandle: "true", target: "node-4", label: "During Hours" },
      { id: "e3-5", source: "node-3", sourceHandle: "false", target: "node-5", label: "After Hours" },
    ],
  },

  // 2. Astrology Prasannam / Urgent Booking Flow
  {
    id: "template-astrology-prasannam",
    name: "Urgent Prasannam Booking & Takeover",
    description: "Emergency Prasannam horary consultation with instant agent takeover and payment instruction.",
    flow_type: "booking",
    businessCategory: "astrology",
    nodes: [
      {
        id: "p-node-1",
        type: "trigger",
        position: { x: 80, y: 140 },
        data: {
          title: "Emergency Keyword Trigger",
          description: "Urgent consultation keywords",
          config: {
            triggerType: "keyword",
            keywords: ["prasannam", "urgent", "பிரசன்னம்", "immediate consultation"],
            matchType: "contains",
          },
        },
      },
      {
        id: "p-node-2",
        type: "message",
        position: { x: 380, y: 140 },
        data: {
          title: "Prasannam Intake Notice",
          description: "Acknowledges urgency and requests active question timestamp",
          config: {
            messageText:
              "Namaste! For immediate Prasannam (Horary Astrology), please write your single most pressing question clearly. The exact timestamp of your message will be locked for the Lagna chart calculation.",
          },
        },
      },
      {
        id: "p-node-3",
        type: "action",
        position: { x: 680, y: 140 },
        data: {
          title: "Human Agent Takeover",
          description: "Suspends bot automation and triggers high-priority alert",
          config: {
            actionType: "human_takeover",
            agentName: "Gokul (Astrologer)",
            crmStage: "proposal_sent",
          },
        },
      },
    ],
    edges: [
      { id: "pe1-2", source: "p-node-1", target: "p-node-2" },
      { id: "pe2-3", source: "p-node-2", target: "p-node-3" },
    ],
  },

  // 3. Vivaham Matrimony New Registration Flow
  {
    id: "template-vivaham-registration",
    name: "Matrimony Profile Registration & Onboarding",
    description: "Welcomes prospective brides and grooms, presents interactive options, and gathers profile documents.",
    flow_type: "intake",
    businessCategory: "vivaham",
    nodes: [
      {
        id: "v-node-1",
        type: "trigger",
        position: { x: 80, y: 140 },
        data: {
          title: "Matrimony Keywords Trigger",
          description: "Listens for Tamil matrimony onboarding phrases",
          config: {
            triggerType: "keyword",
            keywords: ["vivaham", "matrimony", "வரன்", "profile", "registration", "kalyanam"],
            matchType: "contains",
          },
        },
      },
      {
        id: "v-node-2",
        type: "interactive",
        position: { x: 380, y: 140 },
        data: {
          title: "Profile Type Selection",
          description: "Quick reply buttons for groom or bride registration",
          config: {
            interactiveType: "quick_reply",
            messageText:
              "Vanakkam! Welcome to Gokul Vivaham Matrimony 🌸\nWe connect verified, traditional families across Tamil Nadu.\n\nPlease select who you are registering for:",
            buttons: [
              { id: "btn-groom", title: "Groom (மணமகன்)" },
              { id: "btn-bride", title: "Bride (மணமகள்)" },
              { id: "btn-matching", title: "Matchmaking Query" },
            ],
          },
        },
      },
      {
        id: "v-node-3",
        type: "message",
        position: { x: 700, y: 60 },
        data: {
          title: "Groom Registration Checklist",
          description: "Sends digital profile form and horoscope upload link",
          config: {
            messageText:
              "Excellent. Please share:\n1. Groom's Name & Qualification\n2. Profession & Working Location\n3. Rasi, Nakshatram & Gothram\n4. Two recent photographs and PDF horoscope.\n\nOur matchmaker will verify and send compatible matches.",
          },
        },
      },
      {
        id: "v-node-4",
        type: "message",
        position: { x: 700, y: 220 },
        data: {
          title: "Bride Registration Checklist",
          description: "Sends bride profile verification criteria",
          config: {
            messageText:
              "Excellent. Please share:\n1. Bride's Name & Education\n2. Native District & Current City\n3. Rasi, Nakshatram & Chevvai Dosham status\n4. Photographs and horoscope copy.\n\nOur family relationship coordinator will review shortly.",
          },
        },
      },
      {
        id: "v-node-5",
        type: "action",
        position: { x: 1020, y: 140 },
        data: {
          title: "Tag as Matrimony Prospect",
          description: "Updates contact status to Prospect and routes to Vivaham Team",
          config: {
            actionType: "set_crm_stage",
            crmStage: "contacted",
            tag: "Tamil Matrimony",
          },
        },
      },
    ],
    edges: [
      { id: "ve1-2", source: "v-node-1", target: "v-node-2" },
      { id: "ve2-3", source: "v-node-2", sourceHandle: "btn-groom", target: "v-node-3", label: "Groom" },
      { id: "ve2-4", source: "v-node-2", sourceHandle: "btn-bride", target: "v-node-4", label: "Bride" },
      { id: "ve3-5", source: "v-node-3", target: "v-node-5" },
      { id: "ve4-5", source: "v-node-4", target: "v-node-5" },
    ],
  },

  // 4. Vivaham 10-Porutham Compatibility Flow
  {
    id: "template-vivaham-matching",
    name: "10-Porutham Horoscope Matching Request",
    description: "Automates boy & girl star/nakshatra intake for matrimonial compatibility analysis.",
    flow_type: "booking",
    businessCategory: "vivaham",
    nodes: [
      {
        id: "m-node-1",
        type: "trigger",
        position: { x: 80, y: 140 },
        data: {
          title: "Matching Keyword Trigger",
          description: "Porutham and matching keywords",
          config: {
            triggerType: "keyword",
            keywords: ["porutham", "matching", "பொருத்தம்", "star match", "horoscope match"],
            matchType: "contains",
          },
        },
      },
      {
        id: "m-node-2",
        type: "message",
        position: { x: 380, y: 140 },
        data: {
          title: "Horoscope Details Request",
          description: "Requests Nakshatra and Rasi of both parties",
          config: {
            messageText:
              "For 10-Porutham Compatibility Analysis, please send:\n\nBoy's Profile: Name, Rasi, Nakshatram, Paadam\nGirl's Profile: Name, Rasi, Nakshatram, Paadam\n\nOur Vedic astrologer will verify Dina, Gana, Mahendra, Stree Dheerkha, Yoni, Rasi, Rasiyadhipathi, Vasiya, Rajju and Vedha poruthams.",
          },
        },
      },
      {
        id: "m-node-3",
        type: "delay",
        position: { x: 680, y: 140 },
        data: {
          title: "Analysis Processing Wait",
          description: "Allows astrologer 15-minute preparation window",
          config: {
            delayMinutes: 15,
          },
        },
      },
      {
        id: "m-node-4",
        type: "action",
        position: { x: 960, y: 140 },
        data: {
          title: "Assign Matchmaker",
          description: "Alerts matchmaker team to prepare comparative scorecard",
          config: {
            actionType: "assign_agent",
            agentName: "Vivaham Matchmaker",
            crmStage: "proposal_sent",
          },
        },
      },
    ],
    edges: [
      { id: "me1-2", source: "m-node-1", target: "m-node-2" },
      { id: "me2-3", source: "m-node-2", target: "m-node-3" },
      { id: "me3-4", source: "m-node-3", target: "m-node-4" },
    ],
  },
];
