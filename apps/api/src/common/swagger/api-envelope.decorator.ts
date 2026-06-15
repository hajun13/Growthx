import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

/**
 * 응답 봉투(api-contract-convention.md §1·§7)를 OpenAPI 스키마로 표현하는 데코레이터.
 * @nestjs/swagger 는 제네릭 Envelope<T> 를 추론하지 못하므로 getSchemaPath+allOf 로 합성한다.
 */

/** 단건: `{ data: Model }` */
export const ApiOkEnvelope = <TModel extends Type<unknown>>(model: TModel) =>
  applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        type: 'object',
        required: ['data'],
        properties: { data: { $ref: getSchemaPath(model) } },
      },
    }),
  );

/** 목록(페이지네이션): `{ data: Model[], meta }` */
export const ApiOkEnvelopeArray = <TModel extends Type<unknown>>(model: TModel) =>
  applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        type: 'object',
        required: ['data'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: {
            type: 'object',
            properties: {
              page: { type: 'number' },
              pageSize: { type: 'number' },
              total: { type: 'number' },
            },
          },
        },
      },
    }),
  );
