import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentsModule } from '../students/students.module';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { Class, ClassSchema } from './schemas/class.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Class.name, schema: ClassSchema }]),
    // Allocation delegates student mutations to StudentsService.
    StudentsModule,
  ],
  controllers: [ClassesController],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
