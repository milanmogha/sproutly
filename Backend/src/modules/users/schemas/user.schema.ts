import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { UserRole } from '../../../common/enums/user-role.enum';

export type UserDocument = HydratedDocument<User>;

/** One device registered to receive push notifications. */
export interface DeviceToken {
  /** The FCM registration token. Identifies the app install, not the user. */
  token: string;
  platform: 'android' | 'ios';
  updatedAt: Date;
}

/** One signed-in device. A session ends only when the user logs out of it. */
export interface RefreshSession {
  /** Stable id for the device; carried as `sid` in that device's refresh token. */
  sid: string;
  /** bcrypt hash of the refresh token currently issued to this device. */
  hash: string;
  /** bcrypt hash of the token `hash` replaced, honoured until `prevValidUntil`. */
  prevHash?: string | null;
  prevValidUntil?: Date | null;
  createdAt?: Date;
  lastUsedAt?: Date;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  // Optional: parents onboard by phone and may have no email. Sparse so many
  // accounts can share the "no email" state while emails that exist stay unique.
  @Prop({ unique: true, sparse: true, lowercase: true, trim: true })
  email?: string;

  // Login identifier for phone-OTP accounts (parents). Indexed for lookup.
  @Prop({ type: String, default: null, index: true })
  phone?: string;

  // Null while an invited account is still pending (password not yet set).
  @Prop({ type: String, default: null, select: false })
  password?: string | null;

  @Prop({
    type: String,
    enum: UserRole,
    default: UserRole.PARENT,
    index: true,
  })
  role: UserRole;

  /** One entry per signed-in device. Rotated on every refresh, cleared on logout. */
  @Prop({
    type: [
      raw({
        sid: { type: String, required: true },
        hash: { type: String, required: true },
        prevHash: { type: String, default: null },
        prevValidUntil: { type: Date, default: null },
        createdAt: { type: Date },
        lastUsedAt: { type: Date },
      }),
    ],
    default: [],
    select: false,
  })
  refreshSessions?: RefreshSession[];

  /**
   * Where to push. One entry per device the user is signed in on — a parent with
   * a phone and a tablet gets the notification on both.
   *
   * A token belongs to an app install, not a person, so it is moved off any
   * other account when it registers here (see `addDeviceToken`); otherwise a
   * shared phone would keep alerting the previous user. Pruned automatically
   * when FCM reports it as unregistered (app uninstalled).
   */
  @Prop({
    type: [
      raw({
        token: { type: String, required: true },
        platform: { type: String, enum: ['android', 'ios'], required: true },
        updatedAt: { type: Date, default: Date.now },
      }),
    ],
    default: [],
    select: false,
  })
  deviceTokens?: DeviceToken[];

  // Invite onboarding: sha256 of the single-use set-password token + expiry.
  @Prop({ type: String, default: null, select: false })
  invitationTokenHash?: string | null;

  @Prop({ type: Date, default: null })
  invitationExpiresAt?: Date | null;

  // Forgot-password: sha256 of the single-use reset token + expiry. Distinct
  // from the invite token so a live account can be reset without touching (or
  // being blocked by) an onboarding invite that never applies to it.
  @Prop({ type: String, default: null, select: false })
  passwordResetTokenHash?: string | null;

  @Prop({ type: Date, default: null })
  passwordResetExpiresAt?: Date | null;

  // Phone-OTP login (parents): sha256 of the current one-time code + expiry.
  @Prop({ type: String, default: null, select: false })
  otpHash?: string | null;

  @Prop({ type: Date, default: null })
  otpExpiresAt?: Date | null;

  @Prop({ type: Number, default: 0 })
  otpAttempts?: number;

  /** Null only for SUPER_ADMIN; required for every other role. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', default: null, index: true })
  schoolId?: Types.ObjectId | null;

  /** Reminder opt-ins (P7): fee / attendance / homework / event. Absent on
   *  accounts created before the field existed — the service defaults them
   *  to true. Delivery channels (SMS/WhatsApp/push) consult these flags. */
  @Prop(
    raw({
      feeReminders: { type: Boolean },
      attendanceAlerts: { type: Boolean },
      homeworkNotifications: { type: Boolean },
      eventReminders: { type: Boolean },
      messageNotifications: { type: Boolean },
    }),
  )
  notificationPrefs?: Record<string, boolean>;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  lastLoginAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
