import { CartDto } from "../cart/cart.dto.js";

0
export class UserDto {
  id: number;
  supertokensId: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  cart?: CartDto;
  constructor(
    id: number,
    name: string,
    supertokensId: string,
    email: string,
    avatarUrl: string,
    role: string,
    createdAt: Date,
    updatedAt: Date,
    cart?: CartDto
  ) {
    this.id = id;
    this.name = name;
    this.supertokensId = supertokensId;
    this.email = email;
    this.avatarUrl = avatarUrl;
    this.role = role;
    this.cart = cart;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}
