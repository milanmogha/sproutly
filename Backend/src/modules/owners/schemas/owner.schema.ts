import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OwnerDocument = HydratedDocument<Owner>;

/**
 * The person or trust that runs one or more schools.
 *
 * This is a **grouping record, not an account**. Owners never log in: each
 * branch keeps its own admin account, its own `schoolId` and its own data, and
 * tenant isolation stays keyed on the school exactly as before. The owner
 * exists so the super admin can see that three separately-run branches — often
 * under three different names — are one customer.
 *
 * Schools reference it optionally (`School.ownerId`), so a school with no
 * owner is simply an independent school. That is the norm, and the reason
 * nothing needed migrating when this arrived.
 */
@Schema({ timestamps: true })
export class Owner {
  /**
   * The owning entity — "Sharma Educational Trust", or just the owner's name
   * when there is no trust. Not unique: two unrelated owners may share a name,
   * and it is the id that groups branches, never the spelling.
   */
  @Prop({ required: true, trim: true, index: true })
  name: string;

  /** Who to actually call, when that differs from the trust's name. */
  @Prop({ type: String, default: null, trim: true })
  contactPerson?: string | null;

  @Prop({ type: String, default: null, lowercase: true, trim: true })
  email?: string | null;

  @Prop({ type: String, default: null, trim: true })
  phone?: string | null;

  /** Anything the super admin needs to remember about this customer. */
  @Prop({ type: String, default: null, trim: true })
  notes?: string | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const OwnerSchema = SchemaFactory.createForClass(Owner);
