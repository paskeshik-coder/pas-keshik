/**
 * Registry of every screen by name (the names used with ctx.nav.push/reset).
 */

import { intro } from './intro.js?v=1.2.6';
import { signupName, signupMajor, signupUniversity, signupBot } from './signup.js?v=1.2.6';
import { board } from './board.js?v=1.2.6';
import { newRequest, newRequestEnd } from './new-request.js?v=1.2.6';
import { myRequests } from './my-requests.js?v=1.2.6';
import { myOffers } from './my-offers.js?v=1.2.6';
import { offerForm } from './offer-form.js?v=1.2.6';
import { invite } from './invite.js?v=1.2.6';
import { contact } from './contact.js?v=1.2.6';
import { settings } from './settings.js?v=1.2.6';
import { banned } from './banned.js?v=1.2.6';
import { request } from './request.js?v=1.2.6';

export const SCREENS = {
  intro,
  signupName,
  signupMajor,
  signupUniversity,
  signupBot,
  board,
  newRequest,
  newRequestEnd,
  myRequests,
  myOffers,
  offerForm,
  invite,
  contact,
  settings,
  banned,
  request,
};
