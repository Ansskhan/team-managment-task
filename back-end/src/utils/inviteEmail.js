/**
 * Stubbed email delivery for team invites (bonus feature).
 *
 * No SMTP integration on purpose - in production this would go through a
 * transactional email service. Payload is logged so the flow is testable.
 */
export const sendInviteEmail = ({ email, teamName, inviterName, token }) => {
  console.log(
    `[invite:email stub] To: ${email} | Subject: You've been invited to join "${teamName}" by ${inviterName} | Accept: POST /teams/invites/${token}/accept`,
  );
};
