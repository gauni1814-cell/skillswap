// Centralized HTML email templates for SkillSwap

exports.welcomeEmail = ({ name }) => {
  return `
    <div style="font-family: Arial, sans-serif; padding:20px; max-width:600px;">
      <h2 style="color:#4F46E5;">Welcome to SkillSwap, ${name}!</h2>
      <p>Thanks for joining SkillSwap — a place to exchange skills, learn, and grow.</p>
      <ul>
        <li>Find mentors and book live sessions.</li>
        <li>Share your skills and earn reputation.</li>
        <li>Track sessions and reviews in your dashboard.</li>
      </ul>
      <p style="margin-top:16px;">Get started by completing your profile and exploring mentors.</p>
      <p style="color:#6B7280; font-size:13px; margin-top:18px;">Regards,<br/>The SkillSwap Team</p>
    </div>
  `;
};

exports.requestAcceptedEmail = ({ learnerName, mentorName, skill }) => {
  return `
    <div style="font-family: Arial, sans-serif; padding:20px; max-width:600px;">
      <h3 style="color:#4F46E5;">Request Accepted</h3>
      <p>Hello ${learnerName},</p>
      <p>Your request for <strong>${skill}</strong> has been accepted by <strong>${mentorName}</strong>.</p>
      <p>The mentor will schedule a session soon. You'll receive an email when the session is scheduled.</p>
      <p style="color:#6B7280; font-size:13px; margin-top:18px;">Regards,<br/>SkillSwap Team</p>
    </div>
  `;
};

exports.sessionScheduledEmail = ({ learnerName, mentorName, skill, dateStr, meetingLink }) => {
  return `
    <div style="font-family: Arial, sans-serif; padding:20px; max-width:600px;">
      <h3 style="color:#4F46E5;">Session Scheduled</h3>
      <p>Hello ${learnerName},</p>
      <p>Your session with <strong>${mentorName}</strong> has been scheduled.</p>
      <p><strong>Skill:</strong> ${skill}</p>
      <p><strong>Date & Time:</strong> ${dateStr}</p>
      <p style="margin-top:8px;"><strong>Join here:</strong><br/><a href="${meetingLink}" style="color:#4F46E5;">${meetingLink}</a></p>
      <p style="margin-top:12px;">Please join on time. If you need to reschedule, contact your mentor.</p>
      <p style="color:#6B7280; font-size:13px; margin-top:18px;">Regards,<br/>SkillSwap Team</p>
    </div>
  `;
};

exports.requestRejectedEmail = ({ learnerName, mentorName, skill }) => {
  return `
    <div style="font-family: Arial, sans-serif; padding:20px; max-width:600px;">
      <h3 style="color:#EF4444;">Request Update</h3>
      <p>Hello ${learnerName},</p>
      <p>We're sorry — your request for <strong>${skill}</strong> with <strong>${mentorName}</strong> was not accepted.</p>
      <p>You can try requesting another mentor or browse similar skills.</p>
      <p style="color:#6B7280; font-size:13px; margin-top:18px;">Regards,<br/>SkillSwap Team</p>
    </div>
  `;
};

exports.newRequestNotification = ({ mentorName, learnerName, skill, message }) => {
  return `
    <div style="font-family: Arial, sans-serif; padding:20px; max-width:600px;">
      <h3 style="color:#4F46E5;">New Session Request</h3>
      <p>Hello ${mentorName},</p>
      <p><strong>${learnerName}</strong> has requested a session for <strong>${skill}</strong>.</p>
      ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
      <p>Please visit your dashboard to accept and schedule the session.</p>
      <p style="color:#6B7280; font-size:13px; margin-top:18px;">Regards,<br/>SkillSwap Team</p>
    </div>
  `;
};

