import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  /** Login accepts any non-empty password; strength is enforced at credential creation (seeds/ops). */
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}
